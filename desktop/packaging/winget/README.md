# BetterCord Winget manifest

Windows Package Manager (winget) manifest for installing BetterCord on Windows.

## Placeholders

The `PackageVersion` and `InstallerSha256` fields are set to placeholder values across all three manifest files. Update them before submitting to the winget-pkgs repository.

## Manifest files

- `BetterCord.BetterCord.yaml` -- version manifest (required)
- `BetterCord.BetterCord.installer.yaml` -- installer details for x64 and arm64
- `BetterCord.BetterCord.locale.en-US.yaml` -- default locale metadata

## Validating

```bash
winget validate --manifest .
```

## Testing locally

```bash
winget install --manifest .
```

## Fetching the latest version

```bash
curl -s https://api.github.com/repos/davifernan/BetterCord/releases/latest | jq
```

This returns a JSON object containing `tag_name`, `published_at`, and `assets` with download URLs and SHA256 checksums for each format.
