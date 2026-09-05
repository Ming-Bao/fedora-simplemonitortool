/* extension.js
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

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {SystemMonitor} from './systemMonitor.js';

const UPDATE_INTERVAL_SECONDS = 3;
const NOT_AVAILABLE = 'N/A';

function formatPercent(value) {
    return value === null ? NOT_AVAILABLE : `${Math.round(value)}%`;
}

function formatRam(usedGB, totalGB) {
    if (usedGB === null || totalGB === null)
        return NOT_AVAILABLE;
    return `${usedGB.toFixed(1)}/${totalGB.toFixed(1)} GB`;
}

function formatTemp(value) {
    return value === null ? NOT_AVAILABLE : `${Math.round(value)}°C`;
}

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('System Monitor'));

        const box = new St.BoxLayout({style_class: 'simplemontool-box'});
        this.add_child(box);

        this._cpuLabel = this._addMetric(box);
        this._gpuLabel = this._addMetric(box);
        this._ramLabel = this._addMetric(box);

        this._cpuTempItem = new PopupMenu.PopupMenuItem(
            `${_('CPU Temperature')}: ${NOT_AVAILABLE}`, {
                reactive: false,
                can_focus: false,
            });
        this._gpuTempItem = new PopupMenu.PopupMenuItem(
            `${_('GPU Temperature')}: ${NOT_AVAILABLE}`, {
                reactive: false,
                can_focus: false,
            });
        this.menu.addMenuItem(this._cpuTempItem);
        this.menu.addMenuItem(this._gpuTempItem);
    }

    _addMetric(box) {
        const label = new St.Label({
            style_class: 'simplemontool-label',
            y_align: Clutter.ActorAlign.CENTER,
            text: _('Loading…'),
        });
        box.add_child(label);
        return label;
    }

    update(stats) {
        this._cpuLabel.text = `C:${formatPercent(stats.cpuPercent)}`;
        this._gpuLabel.text = `G:${formatPercent(stats.gpuPercent)}`;
        this._ramLabel.text = `R:${formatRam(stats.ramUsedGB, stats.ramTotalGB)}`;

        this._cpuTempItem.label.text =
            `${_('CPU Temperature')}: ${formatTemp(stats.cpuTempC)}`;
        this._gpuTempItem.label.text =
            `${_('GPU Temperature')}: ${formatTemp(stats.gpuTempC)}`;
    }
});

export default class SimpleMonTool extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator, -1, 'left');

        this._monitor = new SystemMonitor(UPDATE_INTERVAL_SECONDS, stats => {
            this._indicator.update(stats);
        });
        this._monitor.start();
    }

    disable() {
        this._monitor.stop();
        this._monitor = null;

        this._indicator.destroy();
        this._indicator = null;
    }
}
