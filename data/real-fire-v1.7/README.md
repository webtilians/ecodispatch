# EcoDispatch v1.7 — datos oficiales de incendios

Descarga realizada el **8 de octubre de 2026** (Europe/Madrid). Preparación de fuentes; se han incorporado únicamente datos y documentación al repositorio, sin modificar el modelo ni sus resultados. No se formula ninguna afirmación de utilidad operativa.

## Contenido y acceso rápido

37 archivos originales, **190.845.748 bytes**.

Ubicación en el repositorio: `data/real-fire-v1.7/`. El archivo `raw/rediam/incendios_historicos.gpkg` se conserva dentro de `raw/rediam/incendios_historicos.gpkg.zip` para evitar el límite de tamaño por archivo de GitHub. El manifiesto distingue el archivo original, su miembro ZIP y el contenedor: se verifican los hashes de ambos. Los demás originales se guardan directamente. No se requiere Git LFS. Los archivos de `raw/` conservan los bytes entregados por los servidores, sin filtrar, reproyectar, limpiar ni modificar. Las exportaciones WFS y EGIF son respuestas generadas por los servicios oficiales, no copias de sus bases internas completas.

| Fuente / archivo | Cobertura comprobada | Contenido |
|---|---|---|
| `raw/egif/incendios-forestales.tgz` | España, 1983–2015 según catálogo y años del RDF | Turtle, ontología OWL y diagrama; 509.593 apariciones de `IdIncendio` en tres archivos de registros; 139.262 geometrías WKT |
| `raw/egif/egif_malaga_1968_2026_consulta.zip` | **Málaga, 1968–2023**, 7.496 partes distintos | Exportación XML de todos los capítulos disponibles; incluye esquema XSD embebido. El nombre refleja el intervalo consultado, no la cobertura efectiva |
| `raw/rediam/incendios_historicos.gpkg` | Capas anuales 1975–2024 y varias recopilaciones históricas | 54 capas. La recopilación más reciente, `incendios_historico_2025_06`, contiene **2.780 entidades** y campañas 1975–2024 |
| `raw/rediam/areas_recorridas_historico.zip` | Campañas 1975–2021 | Respuesta WFS en Shapefile: 2.646 entidades; versión más antigua que el GeoPackage anterior |
| `raw/rediam/perimetros_2008.gpkg` … `perimetros_2025.gpkg` | Andalucía, 2008–2025 | 18 exportaciones WFS completas, **865 entidades** en total |
| `raw/rediam/estadisticas_2025/` | Datos 2024 y series históricas hasta 2024 | 11 tablas ODS de la edición 2025: estadísticas agregadas y medios INFOCA |
| `raw/egif/documentacion/`, `raw/rediam/MdD_AreasRecorrFuego.pdf` | Documentación oficial | Uso del buscador, interpretación de EGIF y modelo de datos de áreas recorridas |
| `raw/egif/diccionarios/provincias_andalucia.json` | Tabla oficial del buscador | Códigos y nombres provinciales de Andalucía |

`manifest.csv` y `manifest.json` registran para **cada original** URL de descarga, página de procedencia, fecha/hora UTC de acceso, fecha local, condiciones de reutilización, formato, tamaño exacto y SHA-256. El JSON añade cobertura, consulta e incidencias de transporte cuando corresponde. `SHA256SUMS.txt` permite comprobar también los documentos y metadatos del paquete.

## Fuentes y cadena de procedencia

- [Catálogo oficial EGIF en datos.gob.es](https://datos.gob.es/es/catalogo/e05068001-estadistica-general-de-incendios-forestales) → `https://datos.iepnb.es/datasets/incendios-forestales.tgz`.
- [MITECO: estadística general de incendios](https://www.miteco.gob.es/es/biodiversidad/temas/incendios-forestales/estadisticas-datos.html) → [buscador público EGIF](https://servicio.mapa.gob.es/incendios/Search/Publico) y documentación. Consulta: Andalucía, Málaga, años 1968–2026; exportación XML con todos los capítulos. El resultado descargado contiene 7.496 partes, todos con `idprovincia=29`; 662 corresponden a 2016–2023. No devuelve partes de 2024–2026. Eso no significa ausencia de incendios en esos años.
- [Junta: áreas recorridas por el fuego](https://www.juntadeandalucia.es/medioambiente/portal/acceso-rediam/observacion-caracterizacion-territorio/observacion/accidentes-desastres-naturales/areas-recorridas-fuego) → servicio WMS → [metadatos oficiales REDIAM](https://portalrediam.cica.es/geonetwork/srv/api/records/0b9aa872-ad3d-4e30-941a-40a9968be6b0/formatters/xml) → carpeta de descargas y WFS `REDIAM_WFS_area_recorrida_fuego`. La carpeta enlazada contiene el GeoPackage original más reciente que el WFS consultado.
- [Junta: perímetros de incendios](https://www.juntadeandalucia.es/medioambiente/portal/landing-page-servicio-ogc/-/asset_publisher/1qlWV3LW9vV6/content/rediam.-wms-per-c3-admetros-de-incendios-forestales-en-andaluc-c3-ada.-2008-2016/20151) → WFS `REDIAM_perimetros_incendios_forestales`. El servicio describe incendios mayores de 10 ha; no representa todos los conatos ni toda la demanda de intervención. Su título, descripción y capas no están totalmente sincronizados; las capas efectivamente descargadas llegan a 2025.
- [Junta: estadística de incendios forestales](https://www.juntadeandalucia.es/medioambiente/portal/acceso-rediam/estadisticas/estadisticas-oficiales/incendios-forestales-en-andalucia) → edición 2025 → carpeta pública de Descargas REDIAM, alojada en `portalrediam.cica.es`. La edición se publicó el 17 de diciembre de 2025; los ficheros corresponden a datos hasta 2024.

Se conservan respuestas de catálogo, capacidades y condiciones en `metadata/`. No se han utilizado repositorios no oficiales ni datos de noticias.

## Campos realmente observados

### EGIF nacional RDF

En los archivos de registros aparecen `IdIncendio`, `prov:wasMemberOf` (año), `geosparql:sfWithin` (provincia y municipio CODINE), y las relaciones `tieneSuperficieAgricola`, `tieneSuperficieArbolada`, `tieneSuperficieForestal`, `tieneSuperficieNoArbolada`, `tieneSuperficieNoForestal`. Los valores y unidades se resuelven en `Spain_values.ttl`, mediante `qudt:numericValue` y `qudt:unit`. Hay referencias `nan` y `None`: no deben convertirse en cero.

`Spain_geom.ttl` tiene 139.262 registros con `hasGeometry`; `Spain_wkts.ttl` aporta igual número de `asWKT`. Los otros archivos tienen 82.929 y 287.402 registros. Pese al nombre `Spain_geom_pre2005.ttl`, en él no se observó `hasGeometry`. No asumir coordenadas para todos los incendios. Los recuentos de esta sección son conteos de registros/predicados, no una auditoría completa de duplicados del RDF.

**No se observaron fecha de día/mes, hora, causa, estado, medios ni duración en las instancias RDF inspeccionadas de todo el archivo.** Que el parte completo de EGIF contemple estos conceptos no significa que este RDF los publique. El catálogo declara fin temporal 2015-10-31; no se puede comprobar ese día mediante un RDF que solo aporta el año.

**Anomalía geográfica conservada:** por ejemplo, el WKT de `2005010001` es `POINT (42.56865838066257 -2.585751011579194)`, mientras el predicado del sistema de referencia declara EPSG:25830. Esos números parecen grados en orden latitud/longitud, no coordenadas proyectadas en metros. No se ha reinterpretado ni reproyectado el archivo; hay que resolver orden de ejes y CRS antes de usarlo.

Inventario de predicados, ejemplos y conteos: `metadata/egif_inventory.json`.

### EGIF XML Málaga

Los siguientes son **campos presentes en registros**, no solo declarados en el XSD:

| Concepto | Ruta dentro de `Pif` | Presencia observada |
|---|---|---|
| Identificación y año | `numeroparte`, `idpif`, `pif_comun/anio` | 7.496 partes; números de parte distintos |
| Fecha y hora de detección | `pif_tiempos/deteccion` | 7.496 valores; 1968-01-01 a 2023-12-16 |
| Fecha y hora de extinción | `pif_tiempos/extinguido` | 7.496 valores |
| Control | `pif_tiempos/controlado` | 3.035 valores no vacíos |
| Llegadas | `llegadapmt`, `llegadapmae`, `llegadapbh`, `llegadapac`, bajo `pif_tiempos` | 6.700 / 1.722 / 779 / 33 valores no vacíos, respectivamente |
| Latitud / longitud | `pif_localizacion/latitud`, `longitud` | 1.939 valores en cada campo |
| Coordenadas proyectadas | `pif_localizacion/x`, `y`, `huso`, `iddatum` | X/Y: 1.939; huso: 1.941; datum: 662 |
| Localización administrativa | `idcomunidad`, `idprovincia`, `idmunicipio`, bajo `pif_localizacion` | 7.496; existen códigos 0 en municipio; no todos son localizaciones utilizables |
| Superficie | `pif_perdidas/superficiearboladatotal`, `superficienoarboladatotal`; también `superficienoarboladaagricola`, `superficienoarboladaotras` | Las dos primeras: 7.496; agrícola: 1.503; otras: 662 |
| Causa | `pif_causa/idcausa`, `idcertidumbrecausa`, `idcausante`, y en parte `idmotivacion`, `idinvestigacioncausa` | Causa: 7.496; motivación: 1.591; investigación: 662 |
| Estado administrativo | `pif_comun/idestadopif`, `idestadocampaniaprovincia` | 7.496; **no equivalen a un estado operativo en tiempo real** |
| Medios | `pif_medios/actuaronmediosestatales`, `RelMedioPersonalPif`, `RelMedioPesadoPif`, `RelMedioAereoPif`, `RelTransportePersonalPif` y relaciones de retardantes | Hay tipos codificados y `numero`; en medios aéreos también `descargas` y `brigadastrans` en parte de las relaciones |
| Duración | No se encontró un campo explícito de duración | Puede derivarse de tiempos después de validarlos; no se ha calculado ni equiparado a tiempo de servicio |

Los recuentos de campos no vacíos **no certifican validez**: hay horas a medianoche, campos ausentes y códigos que requieren interpretación. Los timestamps no incorporan zona horaria explícita. No asumir que detección equivale a ignición o llamada, ni que extinción equivale a liberación de recursos. El XML incluye un XSD, pero no se ha validado contra él; la comprobación realizada confirma que el XML se puede analizar y contar.

Inventario exhaustivo de rutas presentes, frecuencia y ejemplo: `metadata/egif_xml_fields.json`. Las consultas de diccionarios de causa/estado devolvieron HTML, no JSON; no se han incluido como diccionarios. Las respuestas se conservan como incidencias en metadatos. No se han inventado correspondencias de códigos.

### REDIAM: áreas recorridas por el fuego

En la capa acumulada `incendios_historico_2025_06`: `fid`, `geom`, `fecha`, `fecha_inic`, `sensor_ref`, `escena_ref`, `resolucion`, `provincia`, `municipio`, `campana`, `shape_area`, `shape_leng`. `fecha` contiene años; `fecha_inic` suele expresar AAAAMMDD, pero incluye 0, 18991231 y otros valores anómalos. No contiene hora ni latitud/longitud del foco: `geom` representa la superficie quemada.

Las capas anuales difieren: algunas contienen `fecha_fin`, `comentario`, `observacio`, `idparte`, `superficie`, `arbolado`, `matorral`, `pastizales` u otros campos. `fecha_fin` aparece con formatos heterogéneos; no es un campo de duración. `comentario`/`observacio` son anotaciones cartográficas, no estado de extinción. No se observaron campos de causa o medios.

El GeoPackage contiene capas anuales y recopilaciones superpuestas: **no concatenarlas todas**. La capa acumulada más reciente declara SRS 3042; otras capas usan identificadores locales con definiciones propias. Consultar `gpkg_spatial_ref_sys` por capa. No asumir unidades por el nombre de `shape_area` o `shape_leng`, ni utilizar el centroide de un perímetro como si fuera el foco observado. Se conserva el modelo de datos oficial en PDF.

En la capa reciente existen también nombres provinciales inconsistentes o aparentemente municipales dentro de `provincia`. Se han conservado sin normalizar. Inventario por capa: `metadata/areas_gpkg_inventory.json`. El Shapefile WFS adicional es una instantánea más antigua, con cobertura 1975–2021 y atributos de texto: `metadata/areas_inventory.json`.

### REDIAM: perímetros 2008–2025

Atributos: `fid`, `geom`, `Municipio`/`MUNICIPIO`, `Provincia`/`PROVINCIA`, `CODIGO`, `FECHA_INC`, `SUP_ARBOLA`, `SUP_MATORR`, `SUP_PASTIZ` (en 2020–2021: `SUP_PASTI`). Los años 2021–2024 añaden `X_INIC` y `Y_INIC`; 2025 no los incluye. Las superficies y coordenadas de atributos se exportan como texto en estos GeoPackage. No contienen lat/lon explícitas, hora, causa, estado, medios ni duración. `FECHA_INC` muestra fechas AAAAMMDD. El CRS de geometría es el registrado en cada GeoPackage; no atribuir automáticamente ese mismo CRS a X_INIC/Y_INIC sin comprobar documentación.

Se verificó que el número de entidades guardadas coincide, año por año, con `GetFeature resultType=hits`. Esto verifica la descarga del servicio, no la exhaustividad del inventario de incendios. Inventario: `metadata/rediam_inventory.json`; respuestas de conteo en `metadata/hits/`.

### Estadísticas oficiales REDIAM, edición 2025

ODS originales; no se encontró una alternativa CSV enlazada en esa carpeta. Se verificó el contenido XML de las hojas sin convertirlas.

| Prefijo del archivo | Variables/tablas observadas |
|---|---|
| 01 | Provincia, conatos, incendios, siniestros, números/porcentajes y superficies arbolada/matorral/afectada en hectáreas, 2024 |
| 02 | Provincia, causa, número y porcentaje, 2024 |
| 03 | Tipo de causa, causa, siniestros y superficies en hectáreas, 2024 |
| 04 | Provincia, **día de la semana**, causas y recuentos, 2024; no fecha individual de inicio |
| 05 | Intervalos de extensión, recuentos, porcentajes y superficies, 2024 |
| 06 | Año, provincia, conatos, incendios y total, 1990–2024 |
| 07 | Año, provincia y recuentos por causa, 1990–2024 |
| 08 | Año, provincia y superficie arbolada/matorral/total, 1988–2024 |
| 09 | Provincia, tipo de medio material, medio material y número de vehículos, 2024 |
| 10 | Año, sector y puestos de medios humanos, 2014–2024 |
| 11 | Año y superficie de áreas pasto cortafuegos por provincia y Andalucía, 2011–2024 |

Son **agregados**, no partes de incidentes. Las tablas 09–10 describen dotación INFOCA, no asignaciones ni disponibilidad por incendio. No aportan coordenadas de focos, hora, municipio por incidente, estado operativo o duración. Inventario de texto observado: `metadata/statistics_inventory.json`.

## Reutilización y transporte

- RDF EGIF: **CC BY 4.0**, declarada en el catálogo oficial; atribuir al MITECO y conservar procedencia.
- Áreas recorridas: **CC BY 4.0**, declarada en los metadatos REDIAM.
- Perímetros WFS: sus capacidades autorizan uso libre y gratuito con mención a autores y propietarios. No se ha sustituido esta condición por una licencia CC supuesta.
- ODS: condiciones generales de REDIAM, con atribución, conservación del sentido de la información e indicación de su actualización; prevalecen condiciones específicas. No se localizó una licencia CC específica en estas hojas.
- XML EGIF y diccionario provincial: no se localizó licencia específica en la exportación. Se conserva el aviso legal del portal MITECO como referencia, que permite reutilizar su información con atribución y preservación de metadatos, sujeto a derechos de terceros. **No extender automáticamente la licencia CC del RDF a este XML.**

El servidor del RDF presentó un certificado caducado y el buscador EGIF una cadena no validable por el cliente. Las descargas públicas de esos destinos se realizaron con verificación TLS desactivada solo en esas peticiones, sin modificar ajustes globales. Está registrado en el manifiesto. Los hashes garantizan integridad respecto de esta copia local; no son firmas ni hashes publicados por los organismos. REDIAM se descargó con TLS verificado.

## Verificación y próxima integración

Se verificaron tamaños y SHA-256 de los 37 originales, integridad ZIP, lectura del TGZ completo durante el inventario, análisis XML y comprobación de integridad SQLite de los GeoPackage. Las 18 capas WFS y el Shapefile histórico coinciden con sus conteos publicados. `metadata/validation.json` resume el resultado.

Para volver a comprobar los originales: ejecutar `python verify_originals.py` desde cualquier ubicación con Python 3. El script solo lee los archivos y compara con el manifiesto.

La futura v1.7 deberá seleccionar la fuente y cobertura por variable, validar fechas/coordenadas/códigos y documentar cualquier transformación en archivos derivados. No sumar registros de EGIF y REDIAM sin resolver sus relaciones y solapamientos. Conservar estos originales como instantánea. No se han inferido registros ausentes ni parámetros operativos a partir de las estadísticas.
