#!/bin/bash
BB="23.0225,72.5375,23.0565,72.5805"
fetch() {
  for ep in https://overpass-api.de/api/interpreter https://overpass.private.coffee/api/interpreter https://overpass.osm.ch/api/interpreter https://overpass.kumi.systems/api/interpreter; do
    for t in 1 2 3; do
      code=$(curl -s -o "$2" -w "%{http_code}" --max-time 180 -A "JalNiti/1.0" -X POST "$ep" --data-urlencode "data@$1")
      echo "$ep try$t -> $code $(wc -c < "$2")"
      if [ "$code" = "200" ] && [ "$(wc -c < "$2")" -gt 5000 ]; then return 0; fi
      sleep 8
    done
  done
  return 1
}
echo "[out:json][timeout:120];way[\"highway\"~\"^(trunk|primary|secondary|tertiary|residential)\$\"](${BB});out geom;" > /tmp/q_roads.txt
echo "[out:json][timeout:120];(way[\"waterway\"](${BB});way[\"natural\"=\"water\"](${BB}););out geom;" > /tmp/q_water.txt
fetch /tmp/q_roads.txt /tmp/roads.json
fetch /tmp/q_water.txt /tmp/water.json
echo FETCH_DONE
