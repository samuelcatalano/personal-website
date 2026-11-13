// Keep both London cottages while clearing the surveyed street gap; preserve IDs and RNG order.
export const BRIDGE_COTTAGE_SHIFT_X = Object.freeze({
  'country-infill-0-0': -27.0672036547214,
  'country-infill-0-1': -27.0672036547214,
});

export const ESTAIADA_LOT_SHIFT_X = Object.freeze({
  'block--43--93': -1.9,
  'block--24--93': -5.8,
  'rear--20': -1.6,
  'rear--5': 1.9,
});

// Surveyed continuation control points are in the city world frame.
export function bridgeStreetRoute(frame, river, index) {
  const start = [frame.x-frame.tz*river.sigma*river.inAz, frame.z+frame.tx*river.sigma*river.inAz];
  if(index==='estaiada')return[
    [start,[start[0],start[1]-3],[-11.8,-84],[-11.8,-90]],
    [[-11.8,-90],[-11.8,-119]],
    [[-11.8,-119],[-11.8,-126],[-16,-131],[-23,-131]],
    [[-23,-131],[-32,-131]],
  ];
  const x = index === 0 ? 291.6 : 537.5, bend = index === 0 ? -117 : -121.5;
  const end = index === 0 ? [304,-129] : [547,-134], finish = index === 0 ? [307,-129] : [550,-134];
  return [
    [start,[start[0]-frame.tz*river.sigma*5,start[1]+frame.tx*river.sigma*5],[x,-93.5],[x,-97.5]],
    [[x,-97.5],[x,bend]],
    [[x,bend],[x,bend-7],[end[0]-7,end[1]],end],
    [end,finish],
  ];
}

export function bridgeTrafficState(distance, phase, dir, bridgeLength, streetLength = 0) {
  const total = bridgeLength+streetLength, u = (phase*total+distance)%total, s = dir > 0 ? total-u : u;
  const margin=streetLength?1.5:.5;
  return { s, visible: s>margin && s<total-margin };
}
