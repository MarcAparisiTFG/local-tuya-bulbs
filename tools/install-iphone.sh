#!/bin/zsh
# Instala MarsianApp en un iPhone conectado por cable a este Mac, con tu cuenta de desarrollador de Apple
# (pon tu equipo en Xcode o "appleTeamId" en app.json). Un iPhone nuevo se da de alta solo la primera vez.
#   ./tools/install-iphone.sh            → el primer iPhone conectado
#   ./tools/install-iphone.sh "iPhone de Ana"   → el que tenga ese nombre
set -e
cd "$(dirname "$0")/.."
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

# el iPhone conectado (o el que se nombre): su UDID
udid=$(xcrun devicectl list devices 2>/dev/null | awk -v want="$1" '/physical/ && (/available/ || /connected/) && (want == "" || index($0, want)) { for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) { print $i; exit } }')
if [[ -z $udid ]]; then
  echo "No veo ningún iPhone: conéctalo por cable, desbloquéalo y acepta «Confiar en este ordenador»."
  exit 1
fi
echo "Compilando para $udid…"
xcodebuild -workspace ios/MarsianApp.xcworkspace -scheme MarsianApp -configuration Release \
  -destination id=$udid -allowProvisioningUpdates -allowProvisioningDeviceRegistration -derivedDataPath ios/build build -quiet
xcrun devicectl device install app --device $udid ios/build/Build/Products/Release-iphoneos/MarsianApp.app
echo "Listo. La primera vez, en el iPhone: Ajustes → General → VPN y gestión de dispositivos → confiar en tu certificado «Apple Development»."
