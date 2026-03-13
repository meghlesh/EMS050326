import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx"; // ✅ Import xlsx

function EmployeeFullAttendance() {
  const { empId } = useParams();
  const [attendance, setAttendance] = useState([]);
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
   // 🔹 Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
///new dip 09-02-2026
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("accessToken");
        const authAxios = axios.create({
          baseURL: " https://api-tmsdev-be-ede3ccg8dxd3awbw.southindia-01.azurewebsites.net",
          headers: { Authorization: `Bearer ${token}` },
        });

        const empRes = await axios.get(`https://api-tmsdev-be-ede3ccg8dxd3awbw.southindia-01.azurewebsites.net/employees/${empId}`);
        setEmployee(empRes.data);

        const attRes = await authAxios.get(`/attendance/all/${empId}`);
        setAttendance(attRes.data);
        setFilteredAttendance(attRes.data);
      } catch (err) {
        console.error("Error fetching employee attendance:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [empId]);

  const handleFilter = () => {
    if (!fromDate || !toDate) {
      alert("Please select both From and To dates");
      return;
    }
    if (toDate < fromDate) {
      alert('“To” date cannot be earlier than “From” date.');
      return;
    }
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const filtered = attendance.filter((att) => {
      const attDate = new Date(att.date);
      return attDate >= from && attDate <= to;
    });
    setAppliedFromDate(fromDate);  //change by dip 09-02-2025
  setAppliedToDate(toDate);
  setFilteredAttendance(filtered);
  setCurrentPage(1);
  };

  const handleReset = () => {
  setFromDate("");
  setToDate("");
  setAppliedFromDate("");
  setAppliedToDate("");
  setFilteredAttendance(attendance);
  setCurrentPage(1);
  };
// 🔹 Build full calendar data (every date), filling missing days
const buildDataWithFullCalendar = () => {
  const src = filteredAttendance;

  if (!src.length && (!fromDate || !toDate)) return [];

  // Decide range: filter range or earliest-record → today
  let start;
  let end;

   ///change here 0-02-2026
    if (appliedFromDate && appliedToDate) {
  start = new Date(appliedFromDate);
  end = new Date(appliedToDate);
} else if (src.length) {
    const dates = src.map(a => new Date(a.date));
    dates.sort((a, b) => a - b);
    start = dates[0];
    end = new Date(); // today
  } else {
    return [];
  }

  end.setHours(23, 59, 59, 999);

  // Map existing records by normalized date
  const byDate = new Map();
  src.forEach(att => {
    const d = new Date(att.date);
    const key = d.toDateString();
    byDate.set(key, att);
  });

  const result = [];

  // Walk day by day through full range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toDateString();

    if (byDate.has(key)) {
      result.push(byDate.get(key));
    } else {
      const day = d.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = day === 0 || day === 6;

      result.push({
        _id: key,                        // synthetic ID
        date: d.toISOString(),
        dayStatus: isWeekend ? "Weekly Off" : "Absent",
        mode: null,
        workingHours: null,
        checkIn: null,
        checkOut: null,
        employeeCheckInLocation: null,
      });
    }
  }

  return result;
};

  // ✅ Function to export data to Excel
  const handleDownloadExcel = () => {
    if (filteredAttendance.length === 0) {
      alert("No attendance data to download!");
      return;
    }

    // Map data for Excel
    const excelData = filteredAttendance.map((att) => ({
    "EMP ID": employee?.employeeId || id || "N/A",
    "EMP NAME": employee?.name || username || "N/A",


      Date: new Date(att.date).toLocaleDateString("en-GB"),
      Mode: att.mode,
      "Check In": att.checkIn
        ? new Date(att.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "-",
      "Check Out": att.checkOut
        ? new Date(att.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "-",
      "Total Hours": att.workingHours ? `${att.workingHours} hrs` : "-",
      "Day Status": att.dayStatus,
      Details:
        att.regularizationRequest && att.regularizationRequest.status
          ? `Regularization (${att.regularizationRequest.status})`
          : att.dayStatus === "Leave"
            ? `Leave (${att.leaveType || "N/A"})`
            : "Normal Attendance",
    }));

    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    // Download Excel file
    XLSX.writeFile(wb, `${employee?.name || "Employee"}_Attendance.xlsx`);
  };

  //  if (loading) return <p>Loading...</p>;
  if (loading) {
    return (
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: "100vh" }}
      >
        <div
          className="spinner-grow"
          role="status"
          style={{ width: "4rem", height: "4rem", color: "#3A5FBE" }}
        >
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 fw-semibold" style={{ color: "#3A5FBE" }}>Loading ...</p>
      </div>
    );
  }
  // Format: 1 Oct 2025
  const  fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  // Status pill styles
  const statusBase = {
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 32,
    width: 112,

    fontWeight: 500,
    fontSize: 14,
  };
  const statusColors = {
    Present: { background: '#d1f7df' },
    Absent: { background: '#f8d7da' },
    'Half Day': { background: '#fff3cd' },
    'Weekly Off': { background: '#e2e3e5' },
    Working: { background: '#cff4fc' },
    Leave: { background: '#e7e9ff' },
  };
//jacy code
//const sortedAndFilteredData =filteredAttendance()
const sortedAndFilteredData =buildDataWithFullCalendar()
   .filter(att => new Date(att.date) <= new Date())
   .sort((b, a) => new Date(a.date) - new Date(b.date));

    // 🔹 Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedAndFilteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedAndFilteredData.length / itemsPerPage);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const todayISO = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();


  return (
    <div className="container-fluid ">
      {employee && (
        <div className="mb-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h3 className="mb-3" style={{ color: "#3A5FBE", fontSize: "25px" }}>
            <span style={{ textTransform: "capitalize" }}>{employee.name}</span>'s Attendance
          </h3>
                    <button
            className="btn btn-sm custom-outline-btn"
            // style={{ height: "38px",padding: "6px 14px",fontSize: "14px", fontWeight: 600,minWidth: "90px", whiteSpace: "nowrap" }}
            onClick={handleDownloadExcel}
          >
            Download All Attendance Data
          </button>
        </div>
      )}

      {/* 🔹 Filter Section */}
      {/* 🔹 Filter Section */}
    <div className="card mb-4 shadow-sm border-0">
  <div className="card-body">
    <form
      className="row g-2 align-items-center"
      onSubmit={(e) => {
        e.preventDefault();
        handleFilter();
      }}
    >
      {/* From Date */}
      <div className="col-12 col-md-auto d-flex align-items-center  mb-1 ms-2">
        <label
          htmlFor="fromDate"
          className="fw-bold mb-0 text-start text-md-end "
          style={{
             fontSize: "16px",
                  color: "#3A5FBE",
                  width: "50px",
                  minWidth: "50px",
                  marginRight: "8px",
                  textAlign: "right",
                }}
        >
          From
        </label>
        <input
          type="date"
          id="fromDate"
          className="form-control"
          style={{ flex: 1, minWidth: "140px" }}
          value={fromDate}
          max={todayISO}
          onChange={(e) => setFromDate(e.target.value)}
        />
      </div>

      {/* To Date */}
      <div className="col-12 col-md-auto d-flex align-items-center  mb-1 ms-2">
        <label
          htmlFor="toDate"
          className="fw-bold mb-0 text-start text-md-end "
          style={{
            fontSize: "16px",
                  color: "#3A5FBE",
                  width: "50px",
                  minWidth: "50px",
                  marginRight: "8px",
                  textAlign: "right",
                }}
          
        >
          To
        </label>
        <input
          type="date"
          id="toDate"
          className="form-control"
          style={{ flex: 1, minWidth: "140px" }}
          value={toDate}
          max={todayISO}
          onChange={(e) => setToDate(e.target.value)}
        />
      </div>

      {/* Buttons */}
      <div className="col-12 col-md-auto ms-md-auto d-flex gap-2 mb-1 justify-content-end">
        <button
          type="submit"
          className="btn btn-sm custom-outline-btn"
          style={{ minWidth: 90 }}
        >
          Filter
        </button>
        <button
          type="button"
          className="btn btn-sm custom-outline-btn"
          style={{ minWidth: 90 }}
          onClick={handleReset}
        >
          Reset
        </button>
      </div>
    </form>
  </div>
</div>

      {/* 🔹 Table Section */}
      {filteredAttendance.length === 0 ? (
        <p>No attendance records found for selected dates.</p>
      ) : (
        <div className="table-responsive" style={{ background: "#fff" }}>
  <table className="table table-hover mb-0">
    <thead className="table-light" style={{ backgroundColor: "white" }}>
      <tr>
        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Date</th>

        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Check In</th>

        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Check Out</th>

        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Total Hours</th>

        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Mode</th>

        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Status</th>

        <th style={{ backgroundColor: "white", fontWeight: '500', fontSize: '14px', color: '#6c757d', borderBottom: '2px solid #dee2e6', padding: '12px', whiteSpace: 'nowrap' }}>Location</th>
      </tr>
    </thead>
            <tbody>
              {currentItems.map((att) => {
                const date = fmtDate(att.date);
                const checkIn = att.checkIn
                  ? new Date(att.checkIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "-";
                const checkOut = att.checkOut
                  ? new Date(att.checkOut).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "-";
                const workingHours = att.workingHours
                  ? `${att.workingHours} hrs`
                  : "-";
// jacy code
                  const modeDisplay =
                  att.dayStatus === "Absent"||att.dayStatus === "Leave"||att.dayStatus ==="Leave (Sandwiched)"
                    ? "-"
                    : att.dayStatus === "Present" && att.mode === "Office"
                      ? "WFO"
                      : att.mode;


                const reg = att.regularizationRequest;
                const hasRegularization = reg && reg.status !== null;
                const isLeave = att.dayStatus === "Leave";
                const leaveType = att.leaveType;

                let details = "";
                if (hasRegularization) {
                  details = `Regularization (${reg.status})`;
                } else if (isLeave) {
                  details = `Leave (${leaveType || "N/A"})`;
                } else if (att.checkIn || att.checkOut) {
                  details = "Checked In/Out Normally";
                } else {
                  details = "No Activity";
                }

                return (
                  <tr key={att._id}>
                    <td  style={{ padding: '12px', fontSize: '14px', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}>{date}</td>

                    <td  style={{ padding: '12px', fontSize: '14px', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}>{checkIn}</td>
                    <td  style={{ padding: '12px', fontSize: '14px', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}>{checkOut}</td>
                    <td  style={{ padding: '12px', fontSize: '14px', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}>{workingHours}</td>
                    <td  style={{ padding: '12px', fontSize: '14px', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}>{modeDisplay}</td>
                    <td  style={{ padding: '12px', fontSize: '14px', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}><span style={{ ...statusBase, ...(statusColors[att.dayStatus] || {}) }}>{att.dayStatus}</span></td>
                    
                    <td
  style={{
    padding: "12px",
    fontSize: "14px",
    borderBottom: "1px solid #dee2e6",
    whiteSpace: "nowrap",
  }}
>
  {att.employeeCheckInLocation?.address || "N/A"}
</td>{/* <td>{details}</td> */}
                  </tr>
                );
              })}
            </tbody>
          </table>

           
        </div>
      )}
{/* 🔹 Pagination Controls */}
          <nav className="d-flex align-items-center justify-content-end mt-3 text-muted">
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center">
                <span style={{ fontSize: "14px", marginRight: "8px" }}>Rows per page:</span>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto", fontSize: "14px" }}
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>

              <span style={{ fontSize: "14px", marginLeft: "16px" }}>
                {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredAttendance.length)} of {filteredAttendance.length}
              </span>

              <div className="d-flex align-items-center" style={{ marginLeft: "16px" }}>
                <button
                  className="btn btn-sm border-0"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{ fontSize: "18px", padding: "2px 8px" }}
                >
                  ‹
                </button>
                <button
                  className="btn btn-sm border-0"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{ fontSize: "18px", padding: "2px 8px" }}
                >
                  ›
                </button>
              </div>
            </div>
          </nav>
      <div className="text-end mt-3">
        <button
           className="btn btn-sm custom-outline-btn"
            style={{  minWidth: 90 }}
          onClick={() => window.history.go(-1)}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default EmployeeFullAttendance;
