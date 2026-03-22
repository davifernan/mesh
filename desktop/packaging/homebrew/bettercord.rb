cask "bettercord" do
  arch arm: "arm64", intel: "x64"

  version "PLACEHOLDER_VERSION"

  on_arm do
    sha256 "PLACEHOLDER_SHA256_ARM64"
  end
  on_intel do
    sha256 "PLACEHOLDER_SHA256_X64"
  end

  url "https://github.com/davifernan/BetterCord/releases/download/#{version}/BetterCord-#{arch}-#{version}.dmg"
  name "BetterCord"
  desc "Instant messaging and VoIP application"
  homepage "https://github.com/davifernan/BetterCord"

  livecheck do
    url "https://github.com/davifernan/BetterCord/releases/latest"
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :catalina"

  app "BetterCord.app"

  zap trash: [
    "~/Library/Application Support/BetterCord",
    "~/Library/Caches/app.bettercord",
    "~/Library/Caches/app.bettercord.ShipIt",
    "~/Library/Preferences/app.bettercord.plist",
    "~/Library/Saved Application State/app.bettercord.savedState",
  ]
end
