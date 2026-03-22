# BetterCord AUR package

PKGBUILD for the `bettercord-bin` AUR binary package. This installs pre-built binaries rather than building from source, since Electron apps are impractical to compile within the AUR build system.

## Placeholders

The `pkgver` and `sha256sums` fields are set to placeholder values. Update them before publishing:

- Run `updpkgsums` to fetch and fill checksums automatically.
- Alternatively, query the latest version from GitHub releases and update manually.

## Testing locally

```bash
makepkg -si
```

## Fetching the latest version

```bash
curl -s https://api.github.com/repos/davifernan/BetterCord/releases/latest | jq
```

This returns a JSON object containing `tag_name`, `published_at`, and `assets` with download URLs and SHA256 checksums for each format.
