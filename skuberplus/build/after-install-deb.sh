#!/bin/bash

if [[ $1 == "configure" ]]; then
	if type update-alternatives 2>/dev/null >&1; then
		if [[ -L /usr/bin/skuberplus-client && -e /usr/bin/skuberplus-client && "$(readlink /usr/bin/skuberplus-client || true)" != "/etc/alternatives/skuberplus-client" ]]; then
			rm -f /usr/bin/skuberplus-client
		fi
		update-alternatives --install /usr/bin/skuberplus-client skuberplus-client '/opt/Skuber+ Client/skuberplus-client' 100 || ln -sf '/opt/Skuber+ Client/skuberplus-client' /usr/bin/skuberplus-client
	else
		ln -sf '/opt/Skuber+ Client/skuberplus-client' /usr/bin/skuberplus-client
	fi

	if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
		chmod 4755 '/opt/Skuber+ Client/chrome-sandbox' || true
	else
		chmod 0755 '/opt/Skuber+ Client/chrome-sandbox' || true
	fi

	if hash apparmor_parser 2>/dev/null; then
		if apparmor_parser --skip-kernel-load --debug /etc/apparmor.d/skuberplus-client >/dev/null 2>&1; then
			if hash aa-enabled 2>/dev/null && aa-enabled --quiet 2>/dev/null; then
				apparmor_parser --replace --write-cache --skip-read-cache /etc/apparmor.d/skuberplus-client
			fi
		else
			if grep -qs "^[a-z]" /etc/apparmor.d/skuberplus-client; then
				sed -i "s/^/# /" /etc/apparmor.d/skuberplus-client
			fi
		fi
	fi
fi

# Older APT doesn't work with Github releases.

dollar='$'
if dpkg --compare-versions "$(dpkg-query -f "$dollar{Version}" -W apt || true)" lt "2.4.0"; then
	for f in /etc/apt/sources.list.d/skuberplus.sources /etc/apt/sources.list.d/skuberplus-nightly-builds.sources; do
		if [[ -f $f ]]; then
			if grep -qs "^[A-Z]" "$f"; then
				sed -i "s/^/# /" "$f"
			fi
		fi
	done
fi
