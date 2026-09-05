# Simple Monitor Tool

GNOME Shell extension that shows CPU usage, RAM usage, and CPU temperature
in the top panel, plus GPU usage/temperature if an NVIDIA GPU is present.

<img width="366" height="143" alt="image" src="https://github.com/user-attachments/assets/c4a9c77e-1a7e-410e-8589-5e68babb98a7" />

## Requirements

- GNOME Shell 50
- CPU temperature needs a `k10temp` (AMD) or `coretemp` (Intel) sensor
- GPU stats need an NVIDIA GPU with `nvidia-smi` installed

Anything unavailable just shows as `N/A`.

## Installation

Install from [extensions.gnome.org](https://extensions.gnome.org/), or manually:

```sh
git clone https://github.com/Ming-Bao/fedora-simplemonitortool.git
mkdir -p ~/.local/share/gnome-shell/extensions/simplemonitortool@mingbao
cp -r fedora-simplemonitortool/* ~/.local/share/gnome-shell/extensions/simplemonitortool@mingbao/
gnome-extensions enable simplemonitortool@mingbao
```

## License

GPL-2.0-or-later. See [LICENSE](LICENSE).
