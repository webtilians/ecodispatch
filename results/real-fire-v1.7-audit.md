# EGIF Málaga v1.7 — reproducible audit

Descriptive archive only. No parameter tuning or dispatch integration.

Parts: 7496. Years: [1968, 2023]. Valid coordinates: 1929. Valid first arrival: 4209.

Full audit below includes distributions, exclusions, missingness, provenance and fire-active overlap (not brigade occupancy). All durations are minutes. Midnight ambiguity excludes intervals; it is not repaired.

```json
{
  "provenance": {
    "builder_version": "1.7.0",
    "builder_sha256": "6331f1fb3ea84fbf90eb9eb77fc6c2c53de4fae7859cdd797238605e7c6352b4",
    "source_base_commit": "edfbd8ce7cbff8000aae8bc4326df48113eca35a",
    "source": {
      "file": "raw/egif/egif_malaga_1968_2026_consulta.zip",
      "url": "https://servicio.mapa.gob.es/incendios/Search/DescargaZipXml?guid=2c53cb07-9a8c-4a26-8a70-d8fc7beaea74&pakete=",
      "final_url": "https://servicio.mapa.gob.es/incendios/Search/DescargaZipXml?guid=2c53cb07-9a8c-4a26-8a70-d8fc7beaea74&pakete=",
      "source": "https://servicio.mapa.gob.es/incendios/Search/Publico",
      "accessed_at": "2026-10-08T20:56:40.257104+00:00",
      "license": "Licencia especifica EGIF web no localizada. Referencia: aviso legal MITECO autoriza reutilizacion citando fuente y conservando metadatos; no atribuir CC BY del RDF a este XML.",
      "format": "ZIP/XML",
      "size_bytes": 2061046,
      "sha256": "5cad25f4d26d328f179ea3bd7aecc58b0fd314ec214ec2b346257a566b8d1d3a",
      "content_type": "application/zip",
      "tls_verified": false,
      "query": "soypm=0_CA2=4_Pr2=29_AD=1968_AH=2026_ZIF=_TI=_AEP=-1",
      "actual_coverage": "Malaga, 1968-2023; 7496 partes",
      "license_evidence": "metadata/miteco_legal.html",
      "transport_note": "Cadena TLS no validable por el cliente; descarga puntual sin verificacion TLS. Enlace de exportacion temporal; repetir consulta desde buscador.",
      "access_date_madrid": "2026-10-08",
      "official_publisher": "MITECO"
    },
    "xml_member": "Xml_20261008_225637_1.xml",
    "xml_sha256": "e012f000530f71ec32d5afed4d3d4563002e587e305b95edaffa6f417f36628e",
    "imputation": false,
    "rediam_join": false,
    "rules": "docs/real-fire-v1.7.md",
    "timezone": "unknown/local-naive",
    "coordinate_screening_bounds": {
      "south": 36.2,
      "north": 37.5,
      "west": -5.7,
      "east": -3.7
    },
    "quantile_method": "nearest rank",
    "midnight_policy": "retain timestamp; exclude from intervals and hour histogram; date bins retained"
  },
  "total_parts": 7496,
  "year_range": [
    1968,
    2023
  ],
  "timestamp_status_counts": {
    "detected_at": {
      "midnight_precision_unknown": 3,
      "valid": 7493
    },
    "controlled_at": {
      "midnight_precision_unknown": 28,
      "missing": 4461,
      "valid": 3007
    },
    "extinguished_at": {
      "midnight_precision_unknown": 12,
      "valid": 7484
    },
    "llegadapmt": {
      "midnight_precision_unknown": 2486,
      "missing": 796,
      "valid": 4214
    },
    "llegadapmae": {
      "midnight_precision_unknown": 221,
      "missing": 5774,
      "valid": 1501
    },
    "llegadapbh": {
      "missing": 6717,
      "valid": 779
    },
    "llegadapac": {
      "missing": 7463,
      "valid": 33
    }
  },
  "valid_calendar_timestamps": {
    "detected_at": 7496,
    "controlled_at": 3035,
    "extinguished_at": 7496,
    "llegadapmt": 6700,
    "llegadapmae": 1722,
    "llegadapbh": 779,
    "llegadapac": 33
  },
  "valid_coordinates": 1929,
  "coordinate_status_counts": {
    "missing_pair": 5557,
    "valid_rectangle_only": 1929,
    "outside_malaga_screening_rectangle": 10
  },
  "valid_first_arrival": 4209,
  "by_year": {
    "1968": 20,
    "1969": 24,
    "1970": 53,
    "1971": 33,
    "1972": 50,
    "1973": 98,
    "1974": 116,
    "1975": 88,
    "1976": 72,
    "1977": 92,
    "1978": 115,
    "1979": 118,
    "1980": 197,
    "1981": 244,
    "1982": 273,
    "1983": 236,
    "1984": 201,
    "1985": 335,
    "1986": 173,
    "1987": 143,
    "1988": 163,
    "1989": 245,
    "1990": 388,
    "1991": 351,
    "1992": 399,
    "1993": 280,
    "1994": 346,
    "1995": 198,
    "1996": 68,
    "1997": 109,
    "1998": 108,
    "1999": 73,
    "2000": 86,
    "2001": 77,
    "2002": 121,
    "2003": 97,
    "2004": 119,
    "2005": 120,
    "2006": 80,
    "2007": 80,
    "2008": 76,
    "2009": 97,
    "2010": 54,
    "2011": 72,
    "2012": 76,
    "2013": 99,
    "2014": 88,
    "2015": 83,
    "2016": 71,
    "2017": 98,
    "2018": 55,
    "2019": 104,
    "2020": 73,
    "2021": 71,
    "2022": 98,
    "2023": 92
  },
  "by_month": {
    "1": 135,
    "2": 133,
    "3": 214,
    "4": 203,
    "5": 308,
    "6": 698,
    "7": 1571,
    "8": 1804,
    "9": 1449,
    "10": 716,
    "11": 196,
    "12": 69
  },
  "by_hour": {
    "0": 135,
    "1": 123,
    "2": 99,
    "3": 66,
    "4": 70,
    "5": 56,
    "6": 64,
    "7": 68,
    "8": 63,
    "9": 101,
    "10": 223,
    "11": 384,
    "12": 488,
    "13": 643,
    "14": 707,
    "15": 717,
    "16": 719,
    "17": 668,
    "18": 520,
    "19": 441,
    "20": 359,
    "21": 303,
    "22": 264,
    "23": 212
  },
  "by_day_of_week_monday_zero": {
    "0": 1075,
    "1": 1094,
    "2": 975,
    "3": 991,
    "4": 1042,
    "5": 1065,
    "6": 1254
  },
  "hour_histogram_n": 7493,
  "date_histogram_n": 7496,
  "summaries_minutes": {
    "detection_to_control_min": {
      "n": 2973,
      "min": 0.0,
      "median": 110.0,
      "p90": 345.0,
      "p95": 590.0,
      "max": 11814.0,
      "mean": 204.46115
    },
    "detection_to_extinguished_min": {
      "n": 7450,
      "min": 10.0,
      "median": 180.0,
      "p90": 832.0,
      "p95": 1380.0,
      "max": 66085.0,
      "mean": 392.373423
    },
    "detection_to_first_arrival_min": {
      "n": 4209,
      "min": 0.0,
      "median": 28.0,
      "p90": 72.0,
      "p95": 100.0,
      "max": 1465.0,
      "mean": 36.383464
    }
  },
  "fire_active_overlap": {
    "label": "fire-active overlap; not brigade occupancy",
    "interval": "[detection, extinction)",
    "included_intervals": 7450,
    "excluded_intervals": 46,
    "zero_length_intervals": 0,
    "max_simultaneous": 7,
    "window_start": "1968-01-01T20:00:00",
    "window_end": "2023-12-16T17:30:00",
    "window_minutes": 29430570.0,
    "minutes_by_active_count": {
      "0": 26984209.0,
      "1": 2065444.0,
      "2": 306964.0,
      "3": 57165.0,
      "4": 12780.0,
      "5": 3123.0,
      "6": 615.0,
      "7": 270.0
    },
    "fraction_window_with_two_or_more": 0.01294290256695674,
    "time_weighted_mean": 0.09932468178496033
  },
  "missingness": {
    "detected_at": {
      "null": 0,
      "total": 7496
    },
    "controlled_at": {
      "null": 4461,
      "total": 7496
    },
    "extinguished_at": {
      "null": 0,
      "total": 7496
    },
    "llegadapmt": {
      "null": 796,
      "total": 7496
    },
    "llegadapmae": {
      "null": 5774,
      "total": 7496
    },
    "llegadapbh": {
      "null": 6717,
      "total": 7496
    },
    "llegadapac": {
      "null": 7463,
      "total": 7496
    },
    "latitude": {
      "null": 5567,
      "total": 7496
    },
    "longitude": {
      "null": 5567,
      "total": 7496
    },
    "municipality_name": {
      "null": 7496,
      "total": 7496
    },
    "municipality_code": {
      "null": 0,
      "total": 7496
    },
    "cause_code": {
      "null": 0,
      "total": 7496
    },
    "cause_certainty_code": {
      "null": 0,
      "total": 7496
    },
    "cause_actor_code": {
      "null": 0,
      "total": 7496
    },
    "projected_x": {
      "null": 5557,
      "total": 7496
    },
    "projected_y": {
      "null": 5557,
      "total": 7496
    },
    "datum_code": {
      "null": 6834,
      "total": 7496
    },
    "zone": {
      "null": 5555,
      "total": 7496
    },
    "first_arrival_at": {
      "null": 3287,
      "total": 7496
    },
    "detection_to_control_min": {
      "null": 4523,
      "total": 7496
    },
    "detection_to_extinguished_min": {
      "null": 46,
      "total": 7496
    },
    "detection_to_first_arrival_min": {
      "null": 3287,
      "total": 7496
    },
    "burned_area/superficiearboladatotal": {
      "null": 0,
      "total": 7496
    },
    "burned_area/superficienoarboladaagricola": {
      "null": 5993,
      "total": 7496
    },
    "burned_area/superficienoarboladaotras": {
      "null": 6834,
      "total": 7496
    },
    "burned_area/superficienoarboladatotal": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/RelGrupoMedioRetardantePif/idgrupomedioretardante": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/RelGrupoMedioRetardantePif/idpif": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/RelGrupoMedioRetardantePif/numeroparte": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/brigadastrans": {
      "null": 5957,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/descargas": {
      "null": 6098,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/idmedioaereo": {
      "null": 5774,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/idpif": {
      "null": 5774,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/idtitularidadmedio": {
      "null": 5774,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/numero": {
      "null": 5774,
      "total": 7496
    },
    "resources_observed/RelMedioAereoPif/numeroparte": {
      "null": 5774,
      "total": 7496
    },
    "resources_observed/RelMedioPersonalPif/idmediopersonalext": {
      "null": 796,
      "total": 7496
    },
    "resources_observed/RelMedioPersonalPif/idpif": {
      "null": 796,
      "total": 7496
    },
    "resources_observed/RelMedioPersonalPif/idtitularidadmedio": {
      "null": 796,
      "total": 7496
    },
    "resources_observed/RelMedioPersonalPif/numero": {
      "null": 796,
      "total": 7496
    },
    "resources_observed/RelMedioPersonalPif/numeroparte": {
      "null": 796,
      "total": 7496
    },
    "resources_observed/RelMedioPesadoPif/idmediopesado": {
      "null": 2814,
      "total": 7496
    },
    "resources_observed/RelMedioPesadoPif/idpif": {
      "null": 2814,
      "total": 7496
    },
    "resources_observed/RelMedioPesadoPif/idtitularidadmedio": {
      "null": 2814,
      "total": 7496
    },
    "resources_observed/RelMedioPesadoPif/numero": {
      "null": 2814,
      "total": 7496
    },
    "resources_observed/RelMedioPesadoPif/numeroparte": {
      "null": 2814,
      "total": 7496
    },
    "resources_observed/RelRetardantePif/idpif": {
      "null": 6332,
      "total": 7496
    },
    "resources_observed/RelRetardantePif/idretardante": {
      "null": 6332,
      "total": 7496
    },
    "resources_observed/RelRetardantePif/numeroparte": {
      "null": 6332,
      "total": 7496
    },
    "resources_observed/RelTransportePersonalPif/idpif": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/RelTransportePersonalPif/idtransportepersonal": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/RelTransportePersonalPif/numeroparte": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/actuaronmediosestatales": {
      "null": 0,
      "total": 7496
    },
    "resources_observed/numeroparte": {
      "null": 0,
      "total": 7496
    }
  },
  "interval_reason_counts": {
    "detection_to_control_min": {
      "control_after_extinction": 31,
      "endpoint_not_unambiguous": 4492,
      "valid": 2973
    },
    "detection_to_extinguished_min": {
      "control_after_extinction": 31,
      "endpoint_not_unambiguous": 15,
      "valid": 7450
    },
    "llegadapmt": {
      "arrival_after_extinction": 5,
      "endpoint_not_unambiguous": 3285,
      "valid": 4206
    },
    "llegadapmae": {
      "arrival_after_extinction": 2,
      "endpoint_not_unambiguous": 5995,
      "valid": 1499
    },
    "llegadapbh": {
      "arrival_after_extinction": 1,
      "endpoint_not_unambiguous": 6717,
      "valid": 778
    },
    "llegadapac": {
      "endpoint_not_unambiguous": 7463,
      "valid": 33
    },
    "detection_to_first_arrival_min": {
      "no_valid_observed_arrival": 3287,
      "valid": 4209
    }
  },
  "geographic_coverage": {
    "screening_only_not_province_polygon": true,
    "latitude_range": [
      36.3309974948003,
      37.2750364061259
    ],
    "longitude_range": [
      -5.59281475031226,
      -3.7752831856007
    ],
    "by_year": {
      "1968": {
        "parts": 20,
        "coordinates": 0
      },
      "1969": {
        "parts": 24,
        "coordinates": 0
      },
      "1970": {
        "parts": 53,
        "coordinates": 0
      },
      "1971": {
        "parts": 33,
        "coordinates": 0
      },
      "1972": {
        "parts": 50,
        "coordinates": 0
      },
      "1973": {
        "parts": 98,
        "coordinates": 0
      },
      "1974": {
        "parts": 116,
        "coordinates": 0
      },
      "1975": {
        "parts": 88,
        "coordinates": 0
      },
      "1976": {
        "parts": 72,
        "coordinates": 0
      },
      "1977": {
        "parts": 92,
        "coordinates": 0
      },
      "1978": {
        "parts": 115,
        "coordinates": 0
      },
      "1979": {
        "parts": 118,
        "coordinates": 0
      },
      "1980": {
        "parts": 197,
        "coordinates": 0
      },
      "1981": {
        "parts": 244,
        "coordinates": 0
      },
      "1982": {
        "parts": 273,
        "coordinates": 0
      },
      "1983": {
        "parts": 236,
        "coordinates": 0
      },
      "1984": {
        "parts": 201,
        "coordinates": 0
      },
      "1985": {
        "parts": 335,
        "coordinates": 0
      },
      "1986": {
        "parts": 173,
        "coordinates": 0
      },
      "1987": {
        "parts": 143,
        "coordinates": 0
      },
      "1988": {
        "parts": 163,
        "coordinates": 0
      },
      "1989": {
        "parts": 245,
        "coordinates": 0
      },
      "1990": {
        "parts": 388,
        "coordinates": 0
      },
      "1991": {
        "parts": 351,
        "coordinates": 0
      },
      "1992": {
        "parts": 399,
        "coordinates": 0
      },
      "1993": {
        "parts": 280,
        "coordinates": 0
      },
      "1994": {
        "parts": 346,
        "coordinates": 0
      },
      "1995": {
        "parts": 198,
        "coordinates": 0
      },
      "1996": {
        "parts": 68,
        "coordinates": 0
      },
      "1997": {
        "parts": 109,
        "coordinates": 0
      },
      "1998": {
        "parts": 108,
        "coordinates": 0
      },
      "1999": {
        "parts": 73,
        "coordinates": 1
      },
      "2000": {
        "parts": 86,
        "coordinates": 34
      },
      "2001": {
        "parts": 77,
        "coordinates": 29
      },
      "2002": {
        "parts": 121,
        "coordinates": 73
      },
      "2003": {
        "parts": 97,
        "coordinates": 90
      },
      "2004": {
        "parts": 119,
        "coordinates": 119
      },
      "2005": {
        "parts": 120,
        "coordinates": 116
      },
      "2006": {
        "parts": 80,
        "coordinates": 80
      },
      "2007": {
        "parts": 80,
        "coordinates": 80
      },
      "2008": {
        "parts": 76,
        "coordinates": 76
      },
      "2009": {
        "parts": 97,
        "coordinates": 97
      },
      "2010": {
        "parts": 54,
        "coordinates": 54
      },
      "2011": {
        "parts": 72,
        "coordinates": 72
      },
      "2012": {
        "parts": 76,
        "coordinates": 76
      },
      "2013": {
        "parts": 99,
        "coordinates": 99
      },
      "2014": {
        "parts": 88,
        "coordinates": 88
      },
      "2015": {
        "parts": 83,
        "coordinates": 83
      },
      "2016": {
        "parts": 71,
        "coordinates": 71
      },
      "2017": {
        "parts": 98,
        "coordinates": 98
      },
      "2018": {
        "parts": 55,
        "coordinates": 55
      },
      "2019": {
        "parts": 104,
        "coordinates": 104
      },
      "2020": {
        "parts": 73,
        "coordinates": 73
      },
      "2021": {
        "parts": 71,
        "coordinates": 71
      },
      "2022": {
        "parts": 98,
        "coordinates": 98
      },
      "2023": {
        "parts": 92,
        "coordinates": 92
      }
    },
    "municipality_codes_raw": {
      "0": 1593,
      "1": 5,
      "10": 8,
      "100": 83,
      "11": 78,
      "12": 71,
      "13": 39,
      "14": 13,
      "15": 255,
      "16": 3,
      "17": 52,
      "18": 92,
      "19": 24,
      "2": 68,
      "20": 12,
      "21": 21,
      "22": 11,
      "23": 121,
      "24": 28,
      "25": 53,
      "26": 6,
      "27": 1,
      "28": 24,
      "29": 29,
      "3": 9,
      "30": 12,
      "31": 59,
      "32": 66,
      "33": 34,
      "34": 30,
      "35": 90,
      "36": 31,
      "37": 9,
      "38": 64,
      "39": 36,
      "4": 5,
      "40": 81,
      "41": 289,
      "42": 122,
      "43": 27,
      "44": 12,
      "45": 72,
      "46": 135,
      "47": 1,
      "48": 12,
      "49": 14,
      "5": 4,
      "50": 9,
      "51": 280,
      "52": 9,
      "53": 29,
      "54": 28,
      "55": 10,
      "56": 93,
      "57": 32,
      "58": 44,
      "59": 7,
      "6": 37,
      "60": 60,
      "61": 35,
      "63": 22,
      "64": 86,
      "65": 23,
      "66": 4,
      "67": 421,
      "68": 71,
      "69": 325,
      "7": 95,
      "70": 608,
      "71": 9,
      "72": 9,
      "73": 55,
      "74": 17,
      "75": 96,
      "76": 238,
      "77": 22,
      "79": 25,
      "8": 75,
      "80": 60,
      "81": 31,
      "82": 12,
      "83": 12,
      "84": 280,
      "85": 7,
      "86": 10,
      "87": 21,
      "88": 9,
      "89": 80,
      "9": 2,
      "90": 63,
      "901": 8,
      "902": 7,
      "903": 4,
      "904": 1,
      "91": 39,
      "92": 3,
      "93": 6,
      "94": 32,
      "95": 4,
      "96": 5,
      "97": 1,
      "98": 1,
      "99": 20
    }
  }
}
```
