import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { supabase } from "./supabaseClient";

const defaultCenter = [46.8182, 8.2275]; // Schweiz Mitte

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const pulsingDotStyle = `
@keyframes pulse {
  0% { r: 6; opacity: 1; }
  50% { r: 10; opacity: 0.5; }
  100% { r: 6; opacity: 1; }
}
.pulsing-circle {
  animation: pulse 1.5s infinite;
}
`;

function FlyToLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo(location, 14);
    }
  }, [location, map]);
  return null;
}

function App() {
  const [benches, setBenches] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [selectedPos, setSelectedPos] = useState(null);

  const [ambienteRating, setAmbienteRating] = useState(3);
  const [viewRating, setViewRating] = useState(3);
  const [accessibilityRating, setAccessibilityRating] = useState(3);
  const [fireplace, setFireplace] = useState(false);

  const [photoFile1, setPhotoFile1] = useState(null);
  const [photoFile2, setPhotoFile2] = useState(null);
  const [description, setDescription] = useState("");

  const [userLocation, setUserLocation] = useState(null);
  const [editBenchId, setEditBenchId] = useState(null);

  const [filtersVisible, setFiltersVisible] = useState(true);
  const [filterAmbiente, setFilterAmbiente] = useState("");
  const [filterView, setFilterView] = useState("");
  const [filterAccessibility, setFilterAccessibility] = useState("");
  const [filterFireplace, setFilterFireplace] = useState("");

  const fileInputRef1 = useRef();
  const fileInputRef2 = useRef();

  useEffect(() => {
    fetchBenches();
  }, []);

  async function fetchBenches() {
    const { data, error } = await supabase.from("benches").select("*");
    if (!error) setBenches(data);
  }

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        setSelectedPos(e.latlng);
        setFormVisible(false);
      },
    });
    return null;
  }

  async function uploadPhoto(file) {
    if (!file) return null;
    const filename = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("bench-photos")
      .upload(filename, file);
    if (error) {
      console.error("Upload error:", error.message);
      return null;
    }
    const { publicUrl } = supabase.storage
      .from("bench-photos")
      .getPublicUrl(filename).data;
    return publicUrl;
  }

  async function handleSubmit() {
    let photoUrl1 = null;
    let photoUrl2 = null;

    if (photoFile1) {
      photoUrl1 = await uploadPhoto(photoFile1);
    }
    if (photoFile2) {
      photoUrl2 = await uploadPhoto(photoFile2);
    }

    const benchData = {
      lat: selectedPos.lat,
      lng: selectedPos.lng,
      ambiente_rating: ambienteRating,
      view_rating: viewRating,
      accessibility_rating: accessibilityRating,
      fireplace,
      photo_url: photoUrl1,
      photo_url_2: photoUrl2,
      description,
    };

    if (editBenchId) {
      await supabase.from("benches").update(benchData).eq("id", editBenchId);
    } else {
      await supabase.from("benches").insert([benchData]);
    }

    resetForm();
    fetchBenches();
  }

  async function handleDelete(id, photoUrl, photoUrl2) {
    const confirm = window.confirm("Bänkli löschen?");
    if (!confirm) return;
    const toDelete = [];
    if (photoUrl) toDelete.push(photoUrl.split("/").pop());
    if (photoUrl2) toDelete.push(photoUrl2.split("/").pop());
    if (toDelete.length > 0) {
      await supabase.storage.from("bench-photos").remove(toDelete);
    }
    await supabase.from("benches").delete().eq("id", id);
    fetchBenches();
  }

  function startEditing(bench) {
    setSelectedPos({ lat: bench.lat, lng: bench.lng });
    setAmbienteRating(bench.ambiente_rating);
    setViewRating(bench.view_rating);
    setAccessibilityRating(bench.accessibility_rating);
    setFireplace(bench.fireplace);
    setDescription(bench.description || "");
    setEditBenchId(bench.id);
    setFormVisible(true);
  }

  function resetForm() {
    setFormVisible(false);
    setSelectedPos(null);
    setAmbienteRating(3);
    setViewRating(3);
    setAccessibilityRating(3);
    setFireplace(false);
    setPhotoFile1(null);
    setPhotoFile2(null);
    setDescription("");
    setEditBenchId(null);
    if (fileInputRef1.current) fileInputRef1.current.value = null;
    if (fileInputRef2.current) fileInputRef2.current.value = null;
  }

  function handleLocateMe() {
    if (!navigator.geolocation) {
      alert("Standortbestimmung nicht unterstützt");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        alert("Standort konnte nicht ermittelt werden.");
      }
    );
  }

  function filteredBenches() {
    return benches.filter((bench) => {
      return (
        (filterAmbiente === "" ||
          bench.ambiente_rating >= Number(filterAmbiente)) &&
        (filterView === "" || bench.view_rating >= Number(filterView)) &&
        (filterAccessibility === "" ||
          bench.accessibility_rating >= Number(filterAccessibility)) &&
        (filterFireplace === "" ||
          bench.fireplace === (filterFireplace === "true"))
      );
    });
  }

  return (
    <div className="w-screen h-screen relative">
      <style>{pulsingDotStyle}</style>

      {/* Mein Standort */}
      <button
        onClick={handleLocateMe}
        className="absolute z-[1000] top-4 right-4 bg-white px-4 py-2 shadow rounded"
      >
        📍 Mein Standort
      </button>

      {/* Filter-Menü */}
      <div className="absolute z-[1000] top-[96px] left-3 bg-white rounded shadow w-52">
        <button
          onClick={() => setFiltersVisible(!filtersVisible)}
          className="w-full text-left px-3 py-2 bg-gray-100 rounded-t font-medium"
        >
          {filtersVisible ? "Filter ausblenden ▲" : "Filter einblenden ▼"}
        </button>

        {filtersVisible && (
          <div className="px-3 py-3 space-y-3 text-sm">
            <div>
              <div className="block text-gray-700 mb-1">Ambiente</div>
              <select
                value={filterAmbiente}
                onChange={(e) => setFilterAmbiente(e.target.value)}
                className="block w-full border rounded px-2 py-1"
              >
                <option value="">Alle</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="block text-gray-700 mb-1">Aussicht</div>
              <select
                value={filterView}
                onChange={(e) => setFilterView(e.target.value)}
                className="block w-full border rounded px-2 py-1"
              >
                <option value="">Alle</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="block text-gray-700 mb-1">Erreichbarkeit</div>
              <select
                value={filterAccessibility}
                onChange={(e) => setFilterAccessibility(e.target.value)}
                className="block w-full border rounded px-2 py-1"
              >
                <option value="">Alle</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="block text-gray-700 mb-1">Feuerstelle</div>
              <select
                value={filterFireplace}
                onChange={(e) => setFilterFireplace(e.target.value)}
                className="block w-full border rounded px-2 py-1"
              >
                <option value="">Alle</option>
                <option value="true">Ja</option>
                <option value="false">Nein</option>
              </select>
            </div>

            <button
              onClick={() => {
                setFilterAmbiente("");
                setFilterView("");
                setFilterAccessibility("");
                setFilterFireplace("");
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded"
            >
              Filter zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Karte */}
      <MapContainer
        center={userLocation || defaultCenter}
        zoom={userLocation ? 14 : 8}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapClickHandler />

        {userLocation && (
          <>
            <FlyToLocation location={userLocation} />
            <CircleMarker
              center={userLocation}
              pathOptions={{ color: "blue", fillColor: "blue", fillOpacity: 0.5 }}
              radius={8}
              className="pulsing-circle"
            >
              <Popup>📍 Dein Standort</Popup>
            </CircleMarker>
          </>
        )}

        {filteredBenches().map((bench) => (
          <Marker key={bench.id} position={[bench.lat, bench.lng]}>
            <Popup>
              <div style={{ maxWidth: "200px" }}>
                {bench.photo_url && (
                  <a
                    href={bench.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={bench.photo_url}
                      alt="Bänkli"
                      style={{
                        width: "100%",
                        maxHeight: "150px",
                        objectFit: "cover",
                        marginBottom: "0.5rem",
                      }}
                    />
                  </a>
                )}
                {bench.photo_url_2 && (
                  <a
                    href={bench.photo_url_2}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={bench.photo_url_2}
                      alt="Bänkli"
                      style={{
                        width: "100%",
                        maxHeight: "150px",
                        objectFit: "cover",
                        marginBottom: "0.5rem",
                      }}
                    />
                  </a>
                )}
                <p>Ambiente: 🎨 {bench.ambiente_rating}/5</p>
                <p>Aussicht: ⭐ {bench.view_rating}/5</p>
                <p>Erreichbarkeit: ♿ {bench.accessibility_rating}/5</p>
                <p>Feuerstelle: {bench.fireplace ? "🔥 Ja" : "Nein"}</p>
                {bench.description && (
                  <p style={{ marginTop: "0.5rem" }}>ℹ️ {bench.description}</p>
                )}
                <div className="flex justify-between mt-2">
                  <button
                    className="text-blue-600"
                    onClick={() => startEditing(bench)}
                  >
                    🛠 Bearbeiten
                  </button>
                  <button
                    className="text-red-600"
                    onClick={() =>
                      handleDelete(
                        bench.id,
                        bench.photo_url,
                        bench.photo_url_2
                      )
                    }
                  >
                    🗑 Löschen
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {selectedPos && !formVisible && (
          <Marker position={selectedPos}>
            <Popup>
              <div>
                <p>Bänkli hier hinzufügen?</p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFormVisible(true);
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded mt-2"
                >
                  Ja
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    resetForm();
                  }}
                  className="ml-2 bg-gray-400 text-white px-3 py-1 rounded"
                >
                  Abbrechen
                </button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {formVisible && selectedPos && (
        <div className="absolute inset-0 flex justify-center items-center z-[1001] bg-black bg-opacity-50">
          <div className="bg-white p-5 rounded shadow w-[90%] max-w-md">
            <h2 className="font-bold mb-3 text-lg">
              {editBenchId ? "🛠 Bänkli bearbeiten" : "🪑 Neues Bänkli hinzufügen"}
            </h2>

            <div className="grid grid-cols-1 gap-4">
              <label className="block">
                🎨 Ambiente:
                <select
                  value={ambienteRating}
                  onChange={(e) => setAmbienteRating(Number(e.target.value))}
                  className="ml-2 border rounded px-2 py-1"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                🌄 Aussicht:
                <select
                  value={viewRating}
                  onChange={(e) => setViewRating(Number(e.target.value))}
                  className="ml-2 border rounded px-2 py-1"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                ♿ Erreichbarkeit:
                <select
                  value={accessibilityRating}
                  onChange={(e) =>
                    setAccessibilityRating(Number(e.target.value))
                  }
                  className="ml-2 border rounded px-2 py-1"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                🔥 Feuerstelle:
                <input
                  type="checkbox"
                  checked={fireplace}
                  onChange={(e) => setFireplace(e.target.checked)}
                  className="ml-2 align-middle"
                />
              </label>

              <label className="block">
                📸 Foto 1:
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef1}
                  onChange={(e) => setPhotoFile1(e.target.files[0])}
                  className="mt-1"
                />
              </label>

              <label className="block">
                📸 Foto 2:
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef2}
                  onChange={(e) => setPhotoFile2(e.target.files[0])}
                  className="mt-1"
                />
              </label>

              <label className="block">
                ℹ️ Info:
                <textarea
                  maxLength="150"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 border rounded px-2 py-1 w-full"
                />
              </label>
            </div>

            <div className="mt-5 flex space-x-3">
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                onClick={handleSubmit}
              >
                💾 {editBenchId ? "Bänkli aktualisieren" : "Bänkli speichern"}
              </button>
              <button
                className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded"
                onClick={resetForm}
              >
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;