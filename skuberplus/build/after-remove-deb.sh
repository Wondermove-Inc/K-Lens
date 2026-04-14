#!/bin/bash

if [[ $1 == "remove" ]]; then
	if type update-alternatives >/dev/null 2>&1; then
		update-alternatives --remove skuberplus-client /usr/bin/skuberplus-client
	else
		rm -f /usr/bin/skuberplus-client
	fi
fi
