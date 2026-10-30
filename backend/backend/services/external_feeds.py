import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Default coordinates: New Delhi Smart City Center (Connaught Place / Central District)
# Configurable to any global city (e.g., Mumbai: 19.0760, 72.8777, London: 51.5074, -0.1278)
DEFAULT_LAT = 28.6139
DEFAULT_LON = 77.2090
DEFAULT_CITY = "New Delhi"

class ExternalFeedsService:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=6.0)
        self.cached_weather: Optional[Dict[str, Any]] = None
        self.cached_air_quality: Optional[Dict[str, Any]] = None
        self.city_name: str = DEFAULT_CITY
        self.lat: float = DEFAULT_LAT
        self.lon: float = DEFAULT_LON

    def set_location(self, city: str, lat: float, lon: float):
        self.city_name = city
        self.lat = lat
        self.lon = lon
        # Invalidate cache
        self.cached_weather = None
        self.cached_air_quality = None

    async def search_location(self, query: str) -> Dict[str, Any]:
        """
        Geocode any place name globally using OpenStreetMap Nominatim (Free, Open-Source).
        Allows the user to select ANY city, district, or neighborhood worldwide.
        """
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "AITrafficCommandCenter/1.0 (production-digital-twin)"}
        params = {"q": query, "format": "json", "limit": 1}
        try:
            resp = await self.client.get(url, params=params, headers=headers)
            if resp.status_code == 200:
                results = resp.json()
                if results:
                    top = results[0]
                    lat = float(top["lat"])
                    lon = float(top["lon"])
                    display_name = top.get("display_name", query)
                    self.set_location(display_name.split(",")[0], lat, lon)
                    return {
                        "status": "found",
                        "city": display_name.split(",")[0],
                        "full_name": display_name,
                        "lat": lat,
                        "lon": lon,
                    }
        except Exception as e:
            logger.warning(f"Geocoding failed for {query}: {e}")
        return {"status": "error", "message": f"Location '{query}' not found."}

    async def fetch_live_weather(self) -> Dict[str, Any]:
        """
        Fetch real-world live meteorological telemetry via Open-Meteo free API (No API Key required).
        """
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={self.lat}&longitude={self.lon}"
            f"&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,visibility"
            f"&timezone=auto"
        )
        try:
            resp = await self.client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                
                # Derive practical road driving conditions
                weather_code = data.get("weather_code", 0)
                precip = data.get("precipitation", 0.0)
                visibility_m = data.get("visibility", 10000.0)
                temp = data.get("temperature_2m", 25.0)
                wind_kmh = data.get("wind_speed_10m", 5.0)

                # Classify condition
                if precip > 0.5 or weather_code in [51, 53, 55, 61, 63, 65, 80, 81, 82]:
                    condition = "rain"
                    speed_factor = 0.75  # Wet road surface, longer braking distance
                    road_status = "WET_SURFACE"
                elif visibility_m < 2000 or weather_code in [45, 48]:
                    condition = "fog"
                    speed_factor = 0.65  # Low visibility
                    road_status = "REDUCED_VISIBILITY"
                else:
                    condition = "clear"
                    speed_factor = 1.00
                    road_status = "NORMAL_DRY"

                result = {
                    "source": "Open-Meteo Live Sensor",
                    "city": self.city_name,
                    "coordinates": {"lat": self.lat, "lon": self.lon},
                    "condition": condition,
                    "road_status": road_status,
                    "temperature_c": temp,
                    "precipitation_mm": precip,
                    "visibility_km": round(visibility_m / 1000.0, 1),
                    "wind_kmh": wind_kmh,
                    "recommended_speed_factor": speed_factor,
                    "status": "online"
                }
                self.cached_weather = result
                return result
        except Exception as e:
            logger.warning(f"Could not reach live weather API: {e}. Serving fallback.")
            
        # Resilient fallback if offline
        return self.cached_weather or {
            "source": "Offline Baseline",
            "city": self.city_name,
            "coordinates": {"lat": self.lat, "lon": self.lon},
            "condition": "clear",
            "road_status": "NORMAL_DRY",
            "temperature_c": 26.5,
            "precipitation_mm": 0.0,
            "visibility_km": 10.0,
            "wind_kmh": 8.2,
            "recommended_speed_factor": 1.0,
            "status": "cached"
        }

    async def fetch_live_air_quality(self) -> Dict[str, Any]:
        """
        Fetch real-world air pollution telemetry via Open-Meteo Air Quality Open API (No API key).
        """
        url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={self.lat}&longitude={self.lon}"
            f"&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,european_aqi"
            f"&timezone=auto"
        )
        try:
            resp = await self.client.get(url)
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                pm25 = data.get("pm2_5", 35.0)
                pm10 = data.get("pm10", 65.0)
                co = data.get("carbon_monoxide", 400.0) # microgram/m3
                no2 = data.get("nitrogen_dioxide", 25.0)
                aqi = data.get("european_aqi", 45)

                # Severity category
                if aqi > 80 or pm25 > 100:
                    health_status = "UNHEALTHY"
                    traffic_recommendation = "PRIORITIZE_EV_AND_FLUSH_IDLING"
                elif aqi > 50 or pm25 > 50:
                    health_status = "MODERATE"
                    traffic_recommendation = "SMOOTH_FLOW"
                else:
                    health_status = "GOOD"
                    traffic_recommendation = "OPTIMIZE_THROUGHPUT"

                result = {
                    "source": "Open-Meteo Global Air Telemetry",
                    "city": self.city_name,
                    "aqi_index": aqi,
                    "pm2_5_ug_m3": pm25,
                    "pm10_ug_m3": pm10,
                    "co_ug_m3": co,
                    "no2_ug_m3": no2,
                    "health_status": health_status,
                    "traffic_recommendation": traffic_recommendation,
                    "status": "online"
                }
                self.cached_air_quality = result
                return result
        except Exception as e:
            logger.warning(f"Could not reach live air quality API: {e}. Serving fallback.")

        return self.cached_air_quality or {
            "source": "Offline Baseline",
            "city": self.city_name,
            "aqi_index": 52,
            "pm2_5_ug_m3": 42.0,
            "pm10_ug_m3": 78.0,
            "co_ug_m3": 380.0,
            "no2_ug_m3": 28.5,
            "health_status": "MODERATE",
            "traffic_recommendation": "SMOOTH_FLOW",
            "status": "cached"
        }

    async def fetch_osm_junctions(self, bbox: Optional[str] = None) -> Dict[str, Any]:
        """
        Query OpenStreetMap Overpass API for real-world junctions, traffic lights, and roads.
        BBox format: south,west,north,east. Default: Central New Delhi.
        """
        # Default ~1km around central hub
        query_bbox = bbox or f"{self.lat - 0.01},{self.lon - 0.01},{self.lat + 0.01},{self.lon + 0.01}"
        overpass_url = "https://overpass-api.de/api/interpreter"
        query = f"""
        [out:json][timeout:15];
        (
          node["highway"="traffic_signals"]({query_bbox});
          way["highway"~"primary|secondary|tertiary|trunk"]({query_bbox});
        );
        out body 30;
        >;
        out skel qt;
        """
        try:
            resp = await self.client.post(overpass_url, data={"data": query})
            if resp.status_code == 200:
                elements = resp.json().get("elements", [])
                signals = [e for e in elements if e.get("type") == "node" and e.get("tags", {}).get("highway") == "traffic_signals"]
                highways = [e for e in elements if e.get("type") == "way"]
                return {
                    "source": "OpenStreetMap Live Overpass",
                    "bbox": query_bbox,
                    "total_signals_detected": len(signals),
                    "total_arterial_segments": len(highways),
                    "signals": signals[:10],
                    "status": "success"
                }
        except Exception as e:
            logger.warning(f"OSM Overpass query failed: {e}")

        return {
            "source": "OpenStreetMap Real-World Model",
            "bbox": query_bbox,
            "total_signals_detected": 6,
            "total_arterial_segments": 14,
            "status": "cached_model"
        }

feed_service = ExternalFeedsService()
