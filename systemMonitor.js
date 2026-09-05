/* systemMonitor.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

Gio._promisify(Gio.Subprocess.prototype,
    'communicate_utf8_async', 'communicate_utf8_finish');

const HWMON_DIR = '/sys/class/hwmon';
// k10temp: AMD. coretemp: Intel.
const CPU_TEMP_SENSOR_NAMES = ['k10temp', 'coretemp'];

/**
 * Gathers CPU%, RAM usage, NVIDIA GPU%, CPU temperature and GPU temperature
 * on a timer and reports them via a callback. Contains no UI code - reports
 * `null` for any value it can't read instead of throwing, so a missing
 * sensor never brings down the extension.
 */
export class SystemMonitor {
    constructor(intervalSeconds, onUpdate) {
        this._intervalSeconds = intervalSeconds;
        this._onUpdate = onUpdate;

        this._timeoutId = null;
        this._cancellable = null;
        this._stopped = true;

        this._prevCpu = null;
        // undefined = not searched yet, null = searched and not found
        this._cpuTempPath = undefined;
        this._warnedGpu = false;
    }

    start() {
        this._stopped = false;
        this._poll();
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, this._intervalSeconds, () => {
                this._poll();
                return GLib.SOURCE_CONTINUE;
            });
    }

    stop() {
        this._stopped = true;

        if (this._timeoutId !== null) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }
    }

    _poll() {
        const cpuPercent = this._readCpuPercent();
        const {ramUsedGB, ramTotalGB} = this._readRam();
        const cpuTempC = this._readCpuTemp();

        this._readGpu().then(({gpuPercent, gpuTempC}) => {
            if (this._stopped)
                return;

            this._onUpdate({
                cpuPercent, ramUsedGB, ramTotalGB, cpuTempC, gpuPercent, gpuTempC,
            });
        });
    }

    _readFileString(path) {
        try {
            const [ok, bytes] = GLib.file_get_contents(path);
            if (!ok)
                return null;
            return new TextDecoder().decode(bytes);
        } catch (e) {
            return null;
        }
    }

    _readCpuPercent() {
        const text = this._readFileString('/proc/stat');
        if (!text)
            return null;

        // First line: "cpu  user nice system idle iowait irq softirq steal guest guest_nice"
        const line = text.split('\n')[0];
        const fields = line.trim().split(/\s+/).slice(1).map(Number);
        if (fields.some(Number.isNaN))
            return null;

        const idle = fields[3] + (fields[4] ?? 0); // idle + iowait
        const total = fields.reduce((sum, n) => sum + n, 0);

        let percent = null;
        if (this._prevCpu) {
            const idleDelta = idle - this._prevCpu.idle;
            const totalDelta = total - this._prevCpu.total;
            if (totalDelta > 0)
                percent = 100 * (1 - idleDelta / totalDelta);
        }

        this._prevCpu = {idle, total};
        return percent;
    }

    _readRam() {
        const text = this._readFileString('/proc/meminfo');
        if (!text)
            return {ramUsedGB: null, ramTotalGB: null};

        const values = {};
        for (const line of text.split('\n')) {
            const match = line.match(/^(\w+):\s+(\d+)/);
            if (match)
                values[match[1]] = Number(match[2]); // kB
        }

        if (!values.MemTotal || values.MemAvailable === undefined)
            return {ramUsedGB: null, ramTotalGB: null};

        const KB_PER_GB = 1024 * 1024;
        return {
            ramUsedGB: (values.MemTotal - values.MemAvailable) / KB_PER_GB,
            ramTotalGB: values.MemTotal / KB_PER_GB,
        };
    }

    _findCpuTempPath() {
        try {
            const dir = Gio.File.new_for_path(HWMON_DIR);
            const enumerator = dir.enumerate_children(
                'standard::name', Gio.FileQueryInfoFlags.NONE, null);

            let info;
            while ((info = enumerator.next_file(null))) {
                const name = info.get_name();
                const sensorName = this._readFileString(`${HWMON_DIR}/${name}/name`);
                if (sensorName && CPU_TEMP_SENSOR_NAMES.includes(sensorName.trim())) {
                    const tempPath = `${HWMON_DIR}/${name}/temp1_input`;
                    if (GLib.file_test(tempPath, GLib.FileTest.EXISTS))
                        return tempPath;
                }
            }
        } catch (e) {
            logError(e, 'simplemontool: failed to locate CPU temperature sensor');
        }
        return null;
    }

    _readCpuTemp() {
        if (this._cpuTempPath === undefined)
            this._cpuTempPath = this._findCpuTempPath();

        if (this._cpuTempPath === null)
            return null;

        const text = this._readFileString(this._cpuTempPath);
        if (!text)
            return null;

        const milliDegrees = Number(text.trim());
        return Number.isNaN(milliDegrees) ? null : milliDegrees / 1000;
    }

    async _readGpu() {
        if (!this._cancellable)
            this._cancellable = new Gio.Cancellable();

        try {
            const proc = Gio.Subprocess.new(
                ['nvidia-smi', '--query-gpu=utilization.gpu,temperature.gpu',
                    '--format=csv,noheader,nounits'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);

            const [stdout] = await proc.communicate_utf8_async(null, this._cancellable);
            const line = stdout.trim().split('\n')[0];
            const [util, temp] = line.split(',').map(s => Number(s.trim()));

            if (Number.isNaN(util) || Number.isNaN(temp))
                throw new Error(`unexpected nvidia-smi output: ${stdout}`);

            return {gpuPercent: util, gpuTempC: temp};
        } catch (e) {
            if (!this._warnedGpu) {
                logError(e, 'simplemontool: failed to read NVIDIA GPU stats (is nvidia-smi installed?)');
                this._warnedGpu = true;
            }
            return {gpuPercent: null, gpuTempC: null};
        }
    }
}
