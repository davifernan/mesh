# mesh Homebrew cask

Homebrew cask definition for installing mesh on macOS.

## Placeholders

The `version` and `sha256` fields are set to placeholder values. Update them before publishing or submitting to a tap.

## Livecheck

The cask includes a `livecheck` block that queries the mesh GitHub releases for the latest stable version. Homebrew's automated tooling uses this to detect new releases.

## Testing locally

```bash
brew install --cask ./mesh.rb
```

## Fetching the latest version

```bash
curl -s https://api.github.com/repos/davifernan/mesh/releases/latest | jq
```

This returns a JSON object containing `tag_name`, `published_at`, and `assets` with download URLs and SHA256 checksums for each format.
