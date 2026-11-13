# Escape routes data format (web/data/escape-routes.json)

The file holds the depressurization and driftdown escape routes from the operator's Jeppesen ANDES charts.
It is deployed to the server only. It never goes into this public repository, because the chart content belongs to Jeppesen
and the operator.

```json
{
  "status": "ready",
  "source": "Jeppesen ANDES charts, revision 27 NOV 2026",
  "routes": [
    {
      "id": "B788-ANDES1-EB",
      "chart": "ANDES 1",
      "aircraft": "B788",
      "direction": "EB",
      "airway": "UL-XXX",
      "points": [
        { "ident": "AAAAA", "lat": -33.0, "lon": -70.0, "role": "decision", "note": "text as on chart" }
      ],
      "branches": [
        { "from": "AAAAA", "to": "SAME", "label": "Escape to Mendoza", "points": [ { "ident": "BBBBB", "lat": 0, "lon": 0 } ],
          "levels": "driftdown or descent levels as on chart", "msa_ft": 0 }
      ],
      "alternates": ["SCEL", "SAME"],
      "oxygen_note": "as on chart"
    }
  ]
}
```

Rules:
1. Copy identifiers, coordinates, levels and notes exactly as printed on the final chart. Never interpolate.
2. One route per chart, aircraft and direction. Note Guillermo's 11 Nov correction: the 6 Nov 787 ANDES 2 proofs had
   Eastbound and Westbound swapped. Use only the relabelled 13 Nov proofs or the finals.
3. G8000 ANDES 3 Eastbound still lacks the route before EL401 (Jeppesen asked for it on 13 Nov).
