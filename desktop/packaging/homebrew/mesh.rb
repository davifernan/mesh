cask "mesh" do
  arch arm: "arm64", intel: "x64"

  version "PLACEHOLDER_VERSION"

  on_arm do
    sha256 "PLACEHOLDER_SHA256_ARM64"
  end
  on_intel do
    sha256 "PLACEHOLDER_SHA256_X64"
  end

  url "https://github.com/davifernan/mesh/releases/download/#{version}/mesh-#{arch}-#{version}.dmg"
  name "mesh"
  desc "Instant messaging and VoIP application"
  homepage "https://github.com/davifernan/mesh"

  livecheck do
    url "https://github.com/davifernan/mesh/releases/latest"
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :catalina"

  app "mesh.app"

  zap trash: [
    "~/Library/Application Support/mesh",
    "~/Library/Caches/app.mesh",
    "~/Library/Caches/app.mesh.ShipIt",
    "~/Library/Preferences/app.mesh.plist",
    "~/Library/Saved Application State/app.mesh.savedState",
  ]
end
