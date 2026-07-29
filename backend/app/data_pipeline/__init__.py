"""
STEP (a): the data pipeline.

Fetches and caches the three external datasets JalNiti needs for one ward:

    osm_source.py       roads + waterways  (OpenStreetMap via osmnx)
    dem_source.py       30 m elevation     (SRTM via Google Earth Engine)
    rainfall_source.py  rainfall           (IMD gridded history + live nowcast)

Every fetcher goes through cache.py, so running the pipeline twice does not
hit the network twice. Overpass (OSM) and Earth Engine are both rate-limited
and slow; caching is not an optimisation here, it is a requirement.
"""
