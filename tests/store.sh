#!/bin/bash
# Encrypt ./out and add it to the results branch (a separate clone, so the test checkout is never touched).
set -e
TAG="$1"
mkdir -p out; tar czf /tmp/r.tgz out
openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:LAB_KEY -in /tmp/r.tgz -out "/tmp/$TAG.tgz.enc"
URL="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}"
rm -rf /tmp/res; git clone -q --depth 1 --branch results "$URL" /tmp/res
cd /tmp/res; git config user.name lab; git config user.email lab@users.noreply.github.com
mkdir -p runs; cp "/tmp/$TAG.tgz.enc" runs/; git add runs; git commit -qm "results $TAG"
for i in 1 2 3 4 5; do git pull -q --rebase origin results && git push -q origin HEAD:results && exit 0; sleep $((i*7)); done
exit 1
