# Ground truth for the risk model (step c)

`ground_truth.csv` is the **only** hand-collected input in JalNiti. Schema:

```
location,lat,lon,flooded,date
Navrangpura Char Rasta,23.0378,72.5605,yes,2024-07-18
```

- `flooded` — `yes`/`no` (or `1`/`0`)
- `date` — ISO `YYYY-MM-DD`; used to join the IMD rainfall for that day
- `lat`/`lon` — WGS84; snapped to the nearest OSM street segment in step (b)

## Why this file is hand-made

Verified: **no reliable public bulk dataset of historical waterlogging
complaints exists in India.** Municipal grievance portals are per-complaint
lookup tools, not open data. So rows come from, in order of preference:

1. **RTI request** to Ahmedabad Municipal Corporation (may not resolve inside the semester)
2. **News archive mining** — Times of India / Divya Bhaskar Ahmedabad city desk, monsoon months
3. **Resident interviews** — small scale, Navrangpura only
4. Optional cross-check: **Bhuvan-Flood** layer at bhuvan.nrsc.gov.in (free registration) for historic Gujarat flood events

The three rows currently in the file are **placeholders** so the training
script runs end-to-end. Replace them.

Aim for 60–150 rows with a rough 50/50 flooded/not-flooded split. Include
`no` rows deliberately — a model trained only on flooded streets learns
nothing.
