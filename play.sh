#!/usr/bin/env bash
# Quick launcher — delegates to scripts/install-and-launch.sh
exec "$(dirname "$0")/scripts/install-and-launch.sh" "$@"
