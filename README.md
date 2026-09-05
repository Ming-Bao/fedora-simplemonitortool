# Simple Monitor Tool

A lightweight GNOME Shell extension that shows CPU usage, RAM usage, and
CPU temperature directly in the top panel, with GPU usage/temperature shown
too when an NVIDIA GPU is present. No settings, no network access, no
telemetry — it just reads local system files on a timer.

## Panel display

```
C:23%   G:5%   R:6.2/32.0 GB
```

Clicking the indicator opens a menu with CPU and GPU temperature.

## Requirements

- GNOME Shell 50
- CPU temperature requires a `k10temp` (AMD) or `coretemp` (Intel) hwmon
  sensor. If neither is present, temperature shows as `N/A`.
- GPU usage/temperature requires an NVIDIA GPU with the proprietary driver
  and `nvidia-smi` installed. Without it, GPU fields show as `N/A`.

## Installation

### From extensions.gnome.org

Install directly from the [GNOME Extensions website](https://extensions.gnome.org/).

### Manually

```sh
git clone https://github.com/Ming-Bao/fedora-simplemonitortool.git
mkdir -p ~/.local/share/gnome-shell/extensions/simplemonitortool@mingbao
cp -r fedora-simplemonitortool/* ~/.local/share/gnome-shell/extensions/simplemonitortool@mingbao/
```

Then log out and back in (or, on X11, `Alt+F2` → `r` → `Enter`), and enable
the extension with GNOME Extensions or:

```sh
gnome-extensions enable simplemonitortool@mingbao
```

## How it works

- CPU usage: `/proc/stat`
- RAM usage: `/proc/meminfo`
- CPU temperature: `/sys/class/hwmon/*/temp1_input` for a matching sensor
- GPU usage/temperature: `nvidia-smi --query-gpu=utilization.gpu,temperature.gpu`

Everything is read-only; the extension never writes to any of these paths
and never sends data anywhere.

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
