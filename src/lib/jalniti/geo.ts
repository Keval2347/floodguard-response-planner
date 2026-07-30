/** Small geodesy helpers shared by the server pipeline and the UI. */

export type LatLon = [number, number];

export function haversineM(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLengthM(path: LatLon[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += haversineM(path[i - 1], path[i]);
  return n;
}

/** Point on the polyline closest to its half-way distance. */
export function midOf(path: LatLon[]): LatLon {
  const total = pathLengthM(path);
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = haversineM(path[i - 1], path[i]);
    if (acc + seg >= total / 2) return path[i];
    acc += seg;
  }
  return path[Math.floor(path.length / 2)];
}
