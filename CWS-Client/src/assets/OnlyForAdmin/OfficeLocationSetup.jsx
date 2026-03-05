import React, { useState, useEffect } from "react";
import axios from "axios";

function OfficeLocationSetup() {
  const [location, setLocation] = useState({
    name: "Pune Office",
    lat: "",
    lng: "",
    address: "",
  });

  const [editLocation, setEditLocation] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ Fetch existing office location
  useEffect(() => {
    axios
      .get("https://api-emsdev-be-epb9fbg0e7ewese6.southindia-01.azurewebsites.net/admin/office-location")
      .then((res) => {
        if (res.data.length) setLocation(res.data[0]);
      })
      .catch(console.error);
  }, []);

  // ✅ Use Current Location
  const getAddressFromCoords = async (lat, lng) => {
    try {
      const res = await fetch(
        ` https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      return data.display_name || "Unknown location";
    } catch (err) {
      console.error("Reverse geocode error", err);
      return "Unknown location";
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await getAddressFromCoords(latitude, longitude);

        setEditLocation((prev) => ({
          ...prev,
          lat: latitude,
          lng: longitude,
          address,
          name: prev.name || "", // keep existing name editable

        }));

        alert("Current location set!");
      },
      (error) => {
        console.error(error);
        alert("Unable to retrieve your location.");
      }
    );
  };

  // ✅ Open modal & copy current data
  const openModal = () => {
    setEditLocation({ ...location });
    setShowModal(true);
  };

  // ✅ Save changes (only after clicking Save)
  const handleSave = () => {
    setLoading(true);

    axios
      .post("https://api-emsdev-be-epb9fbg0e7ewese6.southindia-01.azurewebsites.net/admin/office-location", editLocation)
      .then(() => {
        setLocation(editLocation); // ✅ Update page only now
        alert("Office location saved");
      })
      .catch(() => alert("Failed to save location"))
      .finally(() => {
        setLoading(false);
        setShowModal(false);
      });
  };
//bg scroll stop
 useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [showModal]);
// dip code changes 09-02-2026
  return (
    <div style={{ padding: "20px" }}>
      <div className="card shadow-sm mb-4 border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="mb-0" style={{ color: "#3A5FBE", fontSize: "20px" }}>
              Set Office Location
            </h6>

            <button 
             className="btn btn-sm custom-outline-btn"
            style={{  minWidth: 90 }}
            onClick={openModal}>
              Edit
            </button>
          </div>

          {/* ✅ Modal */}
          {showModal && (
            <div
              className="modal fade show"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.5)",
                position: "fixed",
                inset: 0,
                zIndex: 1050, 
              }}
            >
              <div className="modal-dialog" style={{ maxWidth: "650px", width: "95%",  }}>
                <div className="modal-content border-0 shadow-lg">
                  <div
                    className="modal-header"
                    style={{
                      backgroundColor: "#3A5FBE",
                      color: "white",
                    }}
                  >
                    <h5 className="modal-title mb-0">Office Location Setup</h5>
                    <button
                      className="btn-close btn-close-white"
                      onClick={() => setShowModal(false)}
                    ></button>
                  </div>

                  <div className="modal-body">
                    {/* Name */}
                    <div className="mb-3">
                      <label className="form-label" style={{ color: "#007BFF" }}>
                        Office Name:
                      </label>
                      <input
                        name="name"
                        value={editLocation.name || ""}
                        onChange={(e) =>
                          setEditLocation({
                            ...editLocation,
                            [e.target.name]: e.target.value,
                          })
                        }
                        className="form-control"
                      // style={{ backgroundColor: "#E9F5FF" }}
                      />
                    </div>

                    {/* Latitude */}
                    <div className="mb-3">
                      <label className="form-label" style={{ color: "#007BFF" }}>
                        Latitude:
                      </label>
                      <input
                        name="lat"
                        value={editLocation.lat || ""}
                        onChange={(e) =>
                          setEditLocation({
                            ...editLocation,
                            [e.target.name]: e.target.value,
                          })
                        }
                        className="form-control"

                      />
                    </div>

                    {/* Longitude */}
                    <div className="mb-3">
                      <label className="form-label" style={{ color: "#007BFF" }}>
                        Longitude:
                      </label>
                      <input
                        name="lng"
                        value={editLocation.lng || ""}
                        onChange={(e) =>
                          setEditLocation({
                            ...editLocation,
                            [e.target.name]: e.target.value,
                          })
                        }
                        className="form-control"

                      />
                    </div>

                    {/* Address */}
                    <div className="mb-3">
                      <label className="form-label" style={{ color: "#007BFF" }}>
                        Address:
                      </label>
                      <input
                        name="address"
                        value={editLocation.address || ""}
                        onChange={(e) =>
                          setEditLocation({
                            ...editLocation,
                            [e.target.name]: e.target.value,
                          })
                        }
                        className="form-control"

                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button 
                   className="btn btn-sm custom-outline-btn"
           
                    onClick={useCurrentLocation}>
                      Use Current Location
                    </button>

                    <button 
                     className="btn btn-sm custom-outline-btn"
         
                    onClick={handleSave}>
                      {loading ? "Saving..." : "Save changes"}
                    </button>

                    <button
                      className="btn btn-sm custom-outline-btn"
          
                      onClick={() => setShowModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ✅ Readonly Display Section */}
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label "  style={{ color: "#3A5FBE" }}>Office Name:</label>
              <input
                value={location.name}
                className="form-control bg-light border-0"
                readOnly
              />
            </div>

            <div className="col-md-6">
              <label className="form-label "  style={{ color: "#3A5FBE" }}>Longitude:</label>
              <input
                value={location.lng}
                className="form-control bg-light border-0"
                readOnly
              />
            </div>

            <div className="col-md-6">
              <label className="form-label "  style={{ color: "#3A5FBE" }}>Latitude:</label>
              <input
                value={location.lat}
                className="form-control bg-light border-0"
                readOnly
              />
            </div>

            <div className="col-md-6">
              <label className="form-label"  style={{ color: "#3A5FBE" }}>Address:</label>
              <input
                value={location.address}
                className="form-control bg-light border-0"
                readOnly
              />
            </div>
          </div>
        </div>
      </div>
       <div className="text-end mt-3">
        <button
          className="btn btn-sm custom-outline-btn"
          style={{ minWidth: 90 }}
          onClick={() => window.history.go(-1)}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default OfficeLocationSetup;