const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require('bcrypt')
const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const User = require("./models/User"); // Your Mongoose User model
const connectDB = require("./db");
const Attendance = require("./models/AttendanceSchema")
const path = require("path");
const fs = require("fs");
const setPasswordTemplate = require('./template/setPasswordTemplate');
const rePasswordTemplate=require('./template/resetPasswordTemplate')
const probationCompletedTemplate=require('./template/probationCompletedTemplate')

// const cloudinary = require("cloudinary").v2;
// const { CloudinaryStorage } = require("multer-storage-cloudinary");
// const  { storage } = require("./cloudinary.js");

// ✅ Import Cloudinary config (convert import → require)
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
dotenv.config();

const app = express();







cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET,
});


// const allowedOrigins = [
//   "https://app-emsdev-fe-btcaabghdmdae0c9.southindia-01.azurewebsites.net",  // production frontend
//   "https://app-emsdev-fe-btcaabghdmdae0c9.southindia-01.azurewebsites.net"              // local development frontend
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     if (!origin) return callback(null, true); // allow non-browser tools like Postman
//     if (allowedOrigins.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   credentials: true, // if sending cookies
// }));


const allowedOrigins = [
"https://www.creativewebsolution.info",
  "http://localhost:5173"
];

// ADD THIS BLOCK HERE for the 304 cache clearing
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  // Important: respond to OPTIONS directly
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});



app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploads folder statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

//db connection
connectDB();

const JWT_SECRET = process.env.JWT_SECRET || "hygggftr4NFDXXgfhgfDFGFafggfhbjhhddfdcvhyttrdfccggjggmkiu8765ghf";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET

app.get("/", (req, res) => {
  res.send("API is running...");
});





























// // Example route (keep as before)
// app.get("/api/ping", (req, res) => {
//   res.json({ ok: true, time: new Date() });
// });

// Multer setup for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/");
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, uniqueSuffix + "-" + file.originalname);
//   },
// });

// ✅ Multer storage using Cloudinary

// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: "uploads", // folder name in Cloudinary
//     resource_type: "auto", // allows images, pdfs, etc.
//   },
// });

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let resourceType = "image";
    if (file.mimetype === "application/pdf") resourceType = "raw";

    return {
      folder: "uploads",
      resource_type: resourceType,
    };
  },
});

const upload = multer({ storage });

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // must be a valid GoDaddy email
    pass: process.env.EMAIL_PASS, // password
  },
});

// Admin authentication middleware
const adminAuthenticate = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing in Authorization header" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Verify Error:", err.message);
        return res.status(403).json({ message: "Invalid or expired token" });
      }

      // Check role
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admins only." });
      }

      req.user = user; // store user info in request
      next();
    });
  } catch (err) {
    console.error("Admin Auth Middleware Error:", err.message);
    res.status(500).json({ message: "Internal server error in authentication" });
  }
};

//userAuthenticate
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Authorization header missing" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing in Authorization header" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Verify Error:", err.message);
        return res.status(403).json({ message: "Invalid/Expired token" });
      }
      req.user = user;
      next();
    });
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    res.status(500).json({ message: "Internal server error in authenticate" });
  }
};

// Routes
app.get("/", (req, res) => {
  res.send("API is running...");
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");


// Admin Add Employee
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
//register Employee
app.post("/admin/add-employee", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "panCardPdf", maxCount: 1 },
  { name: "aadharCardPdf", maxCount: 1 },
  { name: "appointmentLetter", maxCount: 1 },
  { name: "passbookPdf", maxCount: 1 },
  { name: "certificatePdf", maxCount: 1 }
]),
  async (req, res) => {
    try {
      let {
        name,
        email,
        contact,
        employeeId,
        gender,
        dob,
        maritalStatus,
        designation,
        department,
        salary,
        salaryType,
        role,
        doj,
        currentAddress,
        permanentAddress,
        bankDetails,
        pfNumber,
        uanNumber
      } = req.body;
      console.log("emp detaiols", req.body)
      if (!email) return res.status(400).json({ error: "Email is required" });

      // Fix maritalStatus capitalization
      if (maritalStatus) {
        maritalStatus =
          maritalStatus.charAt(0).toUpperCase() + maritalStatus.slice(1).toLowerCase();
      }

      // Prevent duplicates
      const exists = await User.findOne({ $or: [{ email }, { employeeId }] });
      if (exists)
        return res.status(400).json({ error: "Email or Employee ID already exists" });

      // Parse nested objects safely
      let currentAddr = {};
      let permanentAddr = {};
      let bankDtls = {};
      try { currentAddr = JSON.parse(currentAddress); } catch { }
      try { permanentAddr = JSON.parse(permanentAddress); } catch { }
      try { bankDtls = JSON.parse(bankDetails); } catch { }


      // Auto calculate probation end date
      let probationMonths = 6;
      let probationEndDate = null;

      const dojDate = new Date(doj);
      const endDate = new Date(dojDate);

      // Fix auto-adjust overflow by resetting to 1
      endDate.setDate(1);

      // Now add probation months
      endDate.setMonth(dojDate.getMonth() + probationMonths);

      // Restore original date safely
      const day = dojDate.getDate();
      const lastDay = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
      endDate.setDate(Math.min(day, lastDay));

      probationEndDate = endDate;

      // Create new employee
      const newEmployee = new User({
        name,
        email,
        contact,
        employeeId,
        gender,
        dob,
        maritalStatus,
        designation,
        department,
        salary,
        salaryType,
        role,
        doj,
        pfNumber,
        uanNumber,
        probationMonths: 6,              // optional, already in schema
        probationEndDate: probationEndDate,  // <-- AUTO CALCULATED
        password: "",
        // image: req.files?.image?.[0]?.filename || null,
        // panCardPdf: req.files?.panCardPdf?.[0]?.filename || null,
        // aadharCardPdf: req.files?.aadharCardPdf?.[0]?.filename || null,
        // appointmentLetter: req.files?.appointmentLetter?.[0]?.filename || null,
        // bankDetails: { ...bankDtls, passbookPdf: req.files?.passbookPdf?.[0]?.filename || null },
        image: req.files?.image?.[0]?.filename || null,
        panCardPdf: req.files?.panCardPdf?.[0]?.filename || null,
        aadharCardPdf: req.files?.aadharCardPdf?.[0]?.filename || null,
        appointmentLetter: req.files?.appointmentLetter?.[0]?.filename || null,
        certificatePdf: req.files?.certificatePdf?.[0]?.filename || null,

        bankDetails: { ...bankDtls, passbookPdf: req.files?.passbookPdf?.[0]?.filename || null },


        currentAddress: currentAddr,
        permanentAddress: permanentAddr,
      });

      console.log("DOJ received:", doj);
      console.log("Calculated probationEndDate:", probationEndDate);
      console.log("Saving Employee...");


      await newEmployee.save();

      // Generate verification token
      const token = jwt.sign({ _id: newEmployee._id }, JWT_SECRET, { expiresIn: "1d" });
      newEmployee.verifyToken = token;
      await newEmployee.save();

      const verifyLink = `https://www.creativewebsolution.info/employee/verify/${newEmployee._id}/${encodeURIComponent(token)}`;


     const setPasswordHtml = await setPasswordTemplate(verifyLink);
      // Send email safely
      
      try {
        await transporter.sendMail({
          from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Verify your email - set your password",
          html:setPasswordHtml
        });

      } catch (err) {
        console.error("Email sending failed:", err.message);
      }

      res.json({ message: "Employee added successfully & verification link sent!" });

    } catch (err) {
      console.error("Add employee error:", err);
      res.status(500).json({ error: "Server Error" });
    }
  }
);

//verify email by using id
app.get("/employee/verify/:id/:token", async (req, res) => {
  try {
    const { id, token } = req.params;
    const employee = await User.findById(id);
    if (!employee || employee.verifyToken !== token)
      return res.status(400).json({ error: "Invalid or expired link" });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

//once email verify then employee can set the passwords
app.post("/employee/set-password", async (req, res) => {
  try {
    const { id, token, password } = req.body;

    if (!id || !token || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const employee = await User.findById(id);
    if (!employee || employee.verifyToken !== token) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // 🔑 Hash password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    employee.password = hashedPassword;
    employee.verifyToken = null;
    employee.isVerified = true;

    await employee.save();
    res.json({ message: "Password set successfully!" });
  } catch (err) {
    console.error("Set password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


//-------------end registration employee code------------
//-------------------add helper for automatic add leave balance if employee completed probation peroid
async function autoGrantLeaveIfProbationCompleted(user) {
  const today = new Date();

  if (user.probationCompleted === true) return; // already credited
  if (!user.probationEndDate) return;          // no probation date set
  if (today < user.probationEndDate) return;   // still in probation

  // default yearly leave
  const YEARLY_CL = 17;
  const YEARLY_SL = 4;

  // credit leave
  user.casualLeaveBalance += YEARLY_CL;
  user.sickLeaveBalance += YEARLY_SL;

  user.probationCompleted = true;
  user.lastLeaveUpdate = today;



  await user.save();
  console.log(`🎉 Auto leave credited for ${user.name}`);
 const probationHtml= await probationCompletedTemplate();
  // -----------------------------------------------------
  // 1️⃣ SEND EMAIL TO EMPLOYEE
  // -----------------------------------------------------
  try {
    await transporter.sendMail({
      from: `"CWS EMS" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "🎉 Probation Period Completed – Leave Credited",
       html: probationHtml
//       text: `Dear ${user.name},
      

// Congratulations! You have successfully completed your probation period.

// Your yearly leave balance has now been added:
// • Casual Leave: +  ${YEARLY_CL}
// • Sick Leave: +6

// You can check your updated leave balance on your dashboard.

// Best Regards,
// CWS EMS Team`
    });
    console.log("📧 Probation completion email sent!");
  } catch (err) {
    console.error("Email sending failed:", err);
  }

  // -----------------------------------------------------
  // 2️⃣ SEND NOTIFICATION TO EMPLOYEE
  // -----------------------------------------------------
  await Notification.create({
    userId: user._id,
    message: "🎉 Congratulations! You have completed your probation period and yearly leave has been credited.",
    createdAt: new Date()
  });

  // -----------------------------------------------------
  // 3️⃣ SEND NOTIFICATION TO ADMIN
  // -----------------------------------------------------
  const admins = await User.find({ role: "admin" });

  for (const admin of admins) {
    await Notification.create({
      userId: admin._id,
      message: `${user.name} has completed probation and leave balance is credited.`,
      createdAt: new Date()
    });
  }

  // -----------------------------------------------------
  // 4️⃣ SEND NOTIFICATION TO MANAGER (if assigned)
  // -----------------------------------------------------
  if (user.managerId) {
    await Notification.create({
      userId: user.managerId,
      message: `Your team member ${user.name} has completed probation and leave is credited.`,
      createdAt: new Date()
    });
  }
}

//-------------------end helper for automatic add leave balance if employee completed probation peroid


//login code
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body)
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.isDeleted) {
      return res.status(403).json({ message: "Your account has been deactivated" });
    }



    // console.log("👉 Stored password (DB):", user.password);
    // const isMatch = await bcrypt.compare(password, user.password);
    const isMatch = await bcrypt.compare(password, user.password);
    console.log("👉 bcrypt result:", isMatch);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credential" });
    }


    console.log("isMatch", isMatch)







    // -------------------------------------------------------
    // ⭐ AUTO LEAVE CREDIT SECTION
    // -------------------------------------------------------
    await autoGrantLeaveIfProbationCompleted(user);
    // -------------------------------------------------------








    const accessToken = jwt.sign({ _id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "1d" });
    const refreshToken = jwt.sign({ _id: user._id, role: user.role }, JWT_REFRESH_SECRET, { expiresIn: "7d" });


    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      success: true, accessToken, refreshToken, role: user.role, role: user.role,
      username: user.name,   // 👈 send username
      userId: user._id
    });

  } catch (err) {
    console.error("❌ Login error:", err);  // log full error in Vercel logs
    return res.status(500).json({ success: false, error: "Server error: " + err.message });
  }
});

app.get("/me", authenticate, async (req, res) => {
  try {
    console.log("Decoded User:", req.user);  // 👈 log what jwt.verify returned
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ /me route error:", err.message);
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ message: "Refresh Token required" });

  try {
    const user = await User.findOne({ refreshToken });
    if (!user) return res.status(403).json({ message: "Invalid Refresh Token" });

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: "Invalid Refresh Token" });

      // issue new access token
      const newAccessToken = jwt.sign(
        { _id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//update profile 


// Update employee profile
app.put(
  "/employees/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "aadharCardPdf", maxCount: 1 },
    { name: "panCardPdf", maxCount: 1 },
    { name: "appointmentLetter", maxCount: 1 },
    { name: "passbookPdf", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      let employee = await User.findById(id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });

      const body = req.body;

      // ✅ Update simple fields
      const simpleFields = [
        "name", "email", "contact", "employeeId", "gender", "dob",
        "maritalStatus", "designation", "department", "salary", "role",
        "doj", "casualLeaveBalance", "sickLeaveBalance", "probationMonths",
        "pfNumber", "uanNumber"
      ];
      simpleFields.forEach(field => {
        if (body[field]) employee[field] = body[field];
      });

      // ✅ Update nested objects
      ["currentAddress", "permanentAddress", "bankDetails"].forEach(nested => {
        if (body[nested]) {
          try {
            const obj = typeof body[nested] === "string" ? JSON.parse(body[nested]) : body[nested];
            employee[nested] = { ...employee[nested], ...obj };
          } catch { }
        }
      });

      // ✅ Update file fields from Cloudinary
      const files = req.files;
      if (files) {
        const fileMap = {
          image: "image",
          aadharCardPdf: "aadharCardPdf",
          panCardPdf: "panCardPdf",
          appointmentLetter: "appointmentLetter",
          passbookPdf: "passbookPdf"
        };

        Object.keys(fileMap).forEach((key) => {
          if (files[key]?.[0]) {
            const uploadedFile = files[key][0];
            // 🔹 For Cloudinary, use .path (which is the URL)
            const fileUrl = uploadedFile.path;

            if (key === "passbookPdf") {
              employee.bankDetails.passbookPdf = fileUrl;
            } else {
              employee[key] = fileUrl;
            }
          }
        });
      }

      await employee.save();
      res.json(employee);
    } catch (err) {
      console.error("Error updating employee:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);



app.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "Refresh Token required" });
  }
  try {
    // Check if refresh token exists in DB
    const user = await User.findOne({ refreshToken });
    if (!user) {
      return res.status(403).json({ success: false, message: "Invalid Refresh Token" });
    }

    // Remove refresh token from DB
    user.refreshToken = null;
    await user.save();

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
//-------------------end login-logout---------------------------------

//------------------forgotpassword--------------------------------

// // sendpasswordlink
app.post("/sendpasswordlink", async (req, res) => {
  const { email } = req.body;
  // console.log("Email received:", email);

  if (!email) {
    return res.status(400).json({ status: 400, error: "Email is required" });
  }

  try {
    const userfind = await User.findOne({ email: email });
    //console.log("userfind",userfind)

    //token for reset password
    const token = jwt.sign({ _id: userfind._id }, JWT_SECRET, {
      expiresIn: "300s"
    })
    const setusertoken = await User.findByIdAndUpdate({ _id: userfind._id }, { verifytoken: token }, { new: true })
    //console.log("setusertoken",setusertoken)
    const forLink=`https://www.creativewebsolution.info/forgotpassword/${userfind._id}/${setusertoken.verifytoken}`
    const resetPasswordHtml= await rePasswordTemplate(forLink);

    if (setusertoken) {
      const mailOptions = {
        from: "komal@creativewebsolution.in",
        to: email,
        subject: "Password Reset Request - Employee Management System",
       html: resetPasswordHtml
      }

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("error", error)
          res.status(401).json({ status: 401, message: 'mail not send' })
        } else {
          console.log("Email Sent Successfully", info.response)
          res.status(201).json({ status: 201, message: "Email Sent Successfully" })
        }
      })
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, error: "invalid user" });
  }
});
//verify user for forgot password
app.get("/forgotpassword/:id/:token", async (req, res) => {
  const { id, token } = req.params;
  //  console.log(id,token)
  try {
    const validUser = await User.findOne({ _id: id, verifytoken: token })
    //console.log(validUser)
    const verifytoken = jwt.verify(token, JWT_SECRET)
    if (validUser && verifytoken._id) {
      res.status(201).json({ status: 201, validUser })
    } else {
      res.status(401).json({ status: 401, message: "user not exist" })
    }
  } catch (error) {
    res.status(401).json({ status: 401, error })

  }
})
//change password
app.post("/forgotpassword/:id/:token", async (req, res) => {
  const { id, token } = req.params;
  const { password } = req.body;
  console.log(password)
  try {
    const validuser = await User.findOne({ _id: id, verifytoken: token });
    const verifyToken = jwt.verify(token, JWT_SECRET)
    if (validuser && verifyToken._id) {
      const newPassword = await bcrypt.hash(password, 10)
      const setnewuserpass = await User.findByIdAndUpdate({ _id: id }, { password: newPassword })
      setnewuserpass.save();
      res.status(201).json({ status: 201, setnewuserpass })

    } else {
      res.status(401).json({ status: 401, message: "user not exist" })
    }
  } catch (error) {
    res.status(401).json({ status: 401, error })
    console.log(error)
  }
})

//-------------------end forgot password------------------------------------

























































//get all employee details-showing data only admin
app.get("/getAllEmployees", authenticate, async (req, res) => {
  try {
    // Only admin can access
    if (req.user.role !== "admin" && req.user.role !== "ceo" && req.user.role !== "hr") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    // // Fetch all employees from DB
    // const employees = await User.find({ isDeleted: false }).select(
    //   "-password -refreshToken"
    // );

    // Return ALL employees including deleted
    const employees = await User.find().select("-password -refreshToken");

    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE EMPLOYEE API (Soft Delete)
app.delete("/soft/deleteEmployee/:id", authenticate, async (req, res) => {
  try {
    // Only admin, hr, or ceo can delete
    if (req.user.role !== "admin" && req.user.role !== "hr" && req.user.role !== "ceo") {
      return res.status(403).json({ message: "Forbidden: Only admin/hr/ceo can delete employees" });
    }

    const employeeId = req.params.id;

    // Soft delete (set isDeleted = true)
    const deletedEmployee = await User.findByIdAndUpdate(
      employeeId,
      { isDeleted: true },
      { new: true }
    );

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully", employee: deletedEmployee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// // PERMANENTLY DELETE EMPLOYEE (HARD DELETE)
// app.delete("/deleteEmployee/:id", authenticate, async (req, res) => {
//   try {
//     // Only admin, ceo, hr can delete employees
//     if (!["admin", "ceo", "hr"].includes(req.user.role)) {
//       return res.status(403).json({ message: "Forbidden: Only admin/hr/ceo can delete employees" });
//     }

//     const employeeId = req.params.id;

//     // Hard delete — remove the document entirely
//     const deletedEmployee = await User.findByIdAndDelete(employeeId);

//     if (!deletedEmployee) {
//       return res.status(404).json({ message: "Employee not found" });
//     }

//     res.json({ success: true, message: "Employee permanently deleted from database." });
//   } catch (error) {
//     console.error("Error deleting employee:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// });


// PERMANENTLY DELETE EMPLOYEE (HARD DELETE)
app.delete("/deleteEmployee/:id", authenticate, async (req, res) => {
  try {
    // Allow only admin/hr/ceo
    if (!["admin", "ceo", "hr"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "Forbidden: Only admin/hr/ceo can delete employees" });
    }

    const employeeId = req.params.id;

    // Check employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // ✅ Delete all related records
    const [attendanceResult, leaveResult, notificationResult] = await Promise.all([
      Attendance.deleteMany({ employee: employeeId }), // delete attendance
      Leave.deleteMany({ employee: employeeId }), // delete leave records
      Notification.deleteMany({
        $or: [
          { user: employeeId },
          { "regularizationRef.employee": employeeId },
          { "leaveRef.employee": employeeId }
        ]
      }), // delete notifications related to that employee (optional)
    ]);

    // ✅ Finally delete the employee
    const deletedEmployee = await User.findByIdAndDelete(employeeId);

    if (!deletedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({
      success: true,
      message: `Employee permanently deleted along with all related records.`,
      deletedCounts: {
        attendanceDeleted: attendanceResult.deletedCount,
        leavesDeleted: leaveResult.deletedCount,
        notificationsDeleted: notificationResult.deletedCount,
      },
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



//admin can set the office location 
const OfficeLocation = require("./models/OfficeLocationSchema")

// // Add or update office location
// app.post("/admin/office-location", async (req, res) => {
//   try {
//     const { name, lat, lng, address } = req.body;
// console.log(name)
//     let office = await OfficeLocation.findOne({ name });
//     if (office) {
//       office.lat = lat;
//       office.lng = lng;
//       office.address = address;
//     } else {
//       office = new OfficeLocation({ name, lat, lng, address });
//     }

//     await office.save();
//     res.json({ message: "Office location saved", office });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


app.post("/admin/office-location", async (req, res) => {
  try {
    const { _id, name, lat, lng, address } = req.body;
    let office;

    if (_id) {
      // ✅ Update existing office by ID
      office = await OfficeLocation.findByIdAndUpdate(
        _id,
        { name, lat, lng, address },
        { new: true }
      );
    } else {
      // ✅ Create new if none exists
      office = new OfficeLocation({ name, lat, lng, address });
      await office.save();
    }

    res.json({ message: "Office location saved", office });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all office locations
app.get("/admin/office-location", async (req, res) => {
  try {
    const locations = await OfficeLocation.find();
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Helper: get start of today
const getTodayRange = () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return { todayStart, todayEnd };
};
app.get("/today/:employeeId", authenticate, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { todayStart, todayEnd } = getTodayRange();

    const attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    res.json({ attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// Helper function to calculate distance in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}
//Check-in API

// Utility: calculate distance between two GPS points in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in meters
  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const Δφ = (lat2 - lat1) * (Math.PI / 180);
  const Δλ = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d; // in meters
}

// // Check-in API
// app.post("/attendance/:id/checkin", authenticate, async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { lat, lng, address } = req.body;

//     if (!lat || !lng || !address) {
//       return res.status(400).json({ message: "Location required for check-in" });
//     }

//     // Get today
//     const today = getToday();

//     // Fetch office location
//     const office = await OfficeLocation.findOne({ name: "Pune Office" });
//     if (!office) return res.status(400).json({ message: "Office location not set" });

//     // If employee is WFO, check distance
//     const MAX_DISTANCE_METERS = 100; // allow 100m tolerance
//     const distance = getDistanceFromLatLonInMeters(
//       lat,
//       lng,
//       office.lat,
//       office.lng,

//     );

//     if (distance > MAX_DISTANCE_METERS) {
//       return res.status(400).json({ message: "You are not in the office" });
//     }

//     // Find or create attendance for today
//     let attendance = await Attendance.findOne({ employee: id, date: today });

//     if (attendance?.checkIn) {
//       return res.status(400).json({ message: "Already checked in today" });
//     }

//     if (!attendance) {
//       attendance = new Attendance({
//         employee: id,
//         date: today,
//         checkIn: new Date(),
//         checkInLocation: { lat: office.lat, lng: office.lng, address: office.address },
//         employeeCheckInLocation: { lat, lng, address: "Employee location" },
//         mode: "Office",
//         dayStatus: "Present",
//       });
//     } else {
//       attendance.checkIn = new Date();
//       attendance.checkInLocation = { lat: office.lat, lng: office.lng, address: office.address };
//       attendance.employeeCheckInLocation = { lat, lng, address: "Employee location" };
//       attendance.mode = "Office";
//     }

//     await attendance.save();
//     res.json({ message: "Check-in successful", attendance });
//   } catch (err) {
//     console.error("Check-in error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });

// // ✅ Check-out API
// app.post("/attendance/:id/checkout", authenticate, async (req, res) => {
//   try {
//     const { lat, lng, address } = req.body; // get location from frontend
//     const today = getToday();

//     let attendance = await Attendance.findOne({
//       employee: req.params.id,
//       date: today,
//     });

//     if (!attendance?.checkIn) {
//       return res.status(400).json({ message: "Check-in first" });
//     }
//     if (attendance?.checkOut) {
//       return res.status(400).json({ message: "Already checked out today" });
//     }

//     if (!lat || !lng || !address) {
//       return res.status(400).json({ message: "Location required for check-out" });
//     }

//     attendance.checkOut = new Date();
//     attendance.checkOutLocation = { lat, lng, address };
//     attendance.employeeCheckOutLocation = { lat, lng, address: "Employee location" };

//     // Auto-calc working hours
//     const diffMs = attendance.checkOut - attendance.checkIn;
//     attendance.workingHours = Math.round(diffMs / (1000 * 60 * 60) * 100) / 100; // in hours, 2 decimals

//     await attendance.save();
//     res.json({ message: "Check-out successful", attendance });
//   } catch (err) {
//     console.error("Check-out error:", err);
//     res.status(500).json({ message: err.message });
//   }
// });


//above code is only for wfo and below is is form wfo and wfh

app.post("/attendance/:id/checkin", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, address, mode = "Office" } = req.body;

    if (!lat || !lng || !address) {
      return res.status(400).json({ message: "Location required" });
    }

    const today = getToday();

    let attendance = await Attendance.findOne({ employee: id, date: today });

    if (attendance?.checkIn) return res.status(400).json({ message: "Already checked in" });

    if (mode === "Office") {
      const office = await OfficeLocation.findOne({ name: "Pune Office" });
      if (!office) return res.status(400).json({ message: "Office location not set" });

      const distance = getDistanceFromLatLonInMeters(lat, lng, office.lat, office.lng);
      if (distance > 100) return res.status(400).json({ message: "You are not in the office" });

      attendance = attendance || new Attendance({ employee: id, date: today });
      attendance.checkInLocation = { lat: office.lat, lng: office.lng, address: office.address };
    }

    // For WFH, just store employee location
    if (mode === "WFH") {
      attendance = attendance || new Attendance({ employee: id, date: today });
    }

    attendance.checkIn = new Date();
    attendance.employeeCheckInLocation = { lat, lng, address };
    attendance.mode = mode;
    attendance.dayStatus = "Present";

    await attendance.save();
    res.json({ message: "Check-in successful", attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});
app.post("/attendance/:id/checkout", authenticate, async (req, res) => {
  try {
    const { lat, lng, address, mode = "Office" } = req.body;
    const today = getToday();

    let attendance = await Attendance.findOne({ employee: req.params.id, date: today });
    if (!attendance?.checkIn) return res.status(400).json({ message: "Check-in first" });
    if (attendance?.checkOut) return res.status(400).json({ message: "Already checked out" });

    attendance.checkOut = new Date();
    attendance.employeeCheckOutLocation = { lat, lng, address };
    attendance.checkOutLocation = mode === "Office" ? attendance.checkOutLocation : undefined;

    // Calculate working hours
    const diffMs = attendance.checkOut - attendance.checkIn;
    attendance.workingHours = Math.round(diffMs / (1000 * 60 * 60) * 100) / 100;

    await attendance.save();
    res.json({ message: "Check-out successful", attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// ✅ Get today's status
app.get("/today", authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const attendance = await Attendance.findOne({ userId: req.user.id, date: today });
    res.json(attendance || {});
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});


app.get("/attendance/today/:id", async (req, res) => {
  const { id } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({
    employee: id,
    date: today
  });

  if (!attendance) return res.status(404).json({ message: "No record for today" });
  res.json({ attendance });
});

// GET: Today's check-in status for all employees
app.get("/attendance/today", authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // midnight

    // Only admin can access
    if (req.user.role !== "admin" && req.user.role !== "ceo" && req.user.role !== "hr") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    // Get all employees
    const employees = await User.find();

    // Get today's attendance records
    const attendanceRecords = await Attendance.find({
      date: today
    });

    // Map employeeId to attendance
    const attendanceMap = {};
    attendanceRecords.forEach((att) => {
      attendanceMap[att.employee.toString()] = att; // <-- fixed
    });

    // Build response
    // const result = employees.map((emp) => ({
    //   _id: emp._id,
    //   name: emp.name,
    //   email: emp.email,
    //   contact: emp.contact,
    //   role: emp.role,
    //   designation: emp.designation,
    //   department: emp.department,
    //   doj: emp.doj,
    //   dob: emp.dob,

    //   hasCheckedIn: !!attendanceMap[emp._id.toString()],
    //   checkInTime: attendanceMap[emp._id.toString()]
    //     ? attendanceMap[emp._id.toString()].checkIn
    //     : null,

    //      checkOutTime: attendanceMap ? attendanceMap.checkOut : null, // ✅ add 
    // }));

    const result = employees.map((emp) => {
      const att = attendanceMap[emp._id.toString()]; // <-- define att here
      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        contact: emp.contact,
        role: emp.role,
        designation: emp.designation,
        department: emp.department,
        doj: emp.doj,
        dob: emp.dob,

        hasCheckedIn: !!att,
        checkInTime: att ? att.checkIn : null,
        checkOutTime: att ? att.checkOut : null, // ✅ now att exists
      };
    });

    // Count employees who haven't checked in
    const pendingCheckIn = result.filter((r) => !r.hasCheckedIn).length;

    res.json({
      totalEmployees: employees.length,
      pendingCheckIn,
      employees: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



//leave section 
// Utility: months since joining
function monthsSinceJoining(doj) {
  if (!doj) return 0;
  const now = new Date();
  return (now.getFullYear() - doj.getFullYear()) * 12 + (now.getMonth() - doj.getMonth());
}

// Admin: yearly leave allocation (after 6 months probation)
// app.post("/leave/grant-yearly", async (req, res) => {
//   try {
//     const { sl, cl } = req.body; // yearly SL/CL to grant
//     const users = await User.find({ isDeleted: false });

//     let updated = [];
//     for (const user of users) {
//       if (monthsSinceJoining(user.doj) >= 6) {
//         user.sickLeaveBalance += sl;
//         user.casualLeaveBalance += cl;
//         await user.save();
//         updated.push(user._id);
//       }
//     }

//     res.json({ message: "Yearly leave credited", count: updated.length });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

//admin set leave working code
const YearlyLeaveSetting = require("./models/yearlyLeavesSettingsSchema")

app.post("/leave/grant-yearly", async (req, res) => {
  try {
    const { sl, cl } = req.body; // yearly SL/CL to grant
    const currentYear = new Date().getFullYear();

    // Fetch all active employees
    const users = await User.find({ isDeleted: false });
    let updated = [];
    // ✅ Check if already granted for this year
    const existingSetting = await YearlyLeaveSetting.findOne({ year: currentYear });
    if (existingSetting) {
      return res.status(400).json({
        message: `Yearly leaves already granted for ${currentYear}`,
      });
    }
    // ✅ Create a new YearlyLeaveSetting record
    const newSetting = new YearlyLeaveSetting({
      year: currentYear,
      sl,
      cl,
    });
    await newSetting.save();


    for (const user of users) {
      // Skip if employee hasn't completed 6 months
      if (monthsSinceJoining(user.doj) < 6) continue;

      // Skip if already granted this year
      if (user.lastYearlyLeaveGranted === currentYear) continue;

      // Reset old balances (no carry forward)
      user.sickLeaveBalance = 0;
      user.casualLeaveBalance = 0;

      // Add this year's yearly leave
      user.sickLeaveBalance += sl;
      user.casualLeaveBalance += cl;

      // Mark as granted for this year
      user.lastYearlyLeaveGranted = currentYear;

      await user.save();
      updated.push(user._id);
    }

    res.json({
      message: "Yearly leave credited successfully",
      count: updated.length,
    });
  } catch (err) {
    console.error("Error in /leave/grant-yearly:", err);
    res.status(500).json({ error: err.message });
  }
});



// app.post("/leave/reset-all", async (req, res) => {
//   try {
//     // Find all active (non-deleted) users
//     const users = await User.find({ isDeleted: false });

//     let updated = [];

//     for (const user of users) {
//       user.sickLeaveBalance = 0;
//       user.casualLeaveBalance = 0;
//       user.lastYearlyLeaveGranted = null; // optional: reset yearly grant tracking
//       await user.save();
//       updated.push(user._id);
//     }

//     res.json({
//       message: "All employee leave balances have been reset to 0",
//       count: updated.length,
//     });
//   } catch (err) {
//     console.error("Error resetting leave balances:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

app.get("/leave/yearly-settings", async (req, res) => {
  try {
    const settings = await YearlyLeaveSetting.find().sort({ year: -1 });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Reset settings + reset employee leave balances
app.delete("/leave/reset-all", async (req, res) => {
  try {
    // Delete all yearly leave setting records
    await YearlyLeaveSetting.deleteMany({});

    // Reset employee balances
    const result = await User.updateMany(
      { isDeleted: false },
      {
        $set: {
          sickLeaveBalance: 0,
          casualLeaveBalance: 0,
          lastYearlyLeaveGranted: null,
        },
      }
    );

    res.json({
      message: "All yearly leave settings and employee balances have been reset.",
      updatedEmployees: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error resetting yearly leaves:", err);
    res.status(500).json({ error: err.message });
  }
});


// Admin: monthly leave allocation
app.post("/leave/grant-monthly", async (req, res) => {
  try {
    const { sl, cl } = req.body; // monthly SL/CL to grant
    const users = await User.find({ isDeleted: false });

    let updated = [];
    for (const user of users) {
      if (monthsSinceJoining(user.doj) >= 6) {
        user.sickLeaveBalance += sl;
        user.casualLeaveBalance += cl;
        await user.save();
        updated.push(user._id);
      }
    }

    res.json({ message: "Monthly leave credited", count: updated.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /leave/balance
app.get("/leave/balance", async (req, res) => {
  try {
    // Find any user (for admin view, you can later change this to logged-in user)
    const user = await User.findOne();

    // If no user found
    if (!user) {
      return res.status(404).json({ message: "No user found" });
    }

    // Return their leave balance
    res.json({
      sl: user.sickLeaveBalance,
      cl: user.casualLeaveBalance,
      lwp: user.LwpLeave,
    });
  } catch (err) {
    console.error("❌ Error fetching leave balance:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});


// Get employee leave balance
app.get("/leave/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("name sickLeaveBalance casualLeaveBalance");
    if (!user) return res.status(404).json({ message: "Employee not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//---------------------admin set leave balance and employee get leave balance--------------------------


const Leave = require('./models/LeaveSchema');

// get reoprting manager by id
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("reportingManager", "name employeeId contact designation role image"); // populate manager

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// Apply for leave
// app.post("/leave/apply", async (req, res) => {
//   try {
//     const {
//       employeeId,
//       reportingManagerId,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//     } = req.body;

//     const employee = await User.findById(employeeId);
//     const manager = await User.findById(reportingManagerId);

//     if (!employee || !manager) {
//       return res.status(404).json({ error: "Employee or Manager not found" });
//     }

//     const leave = new Leave({
//       employee: employee._id,
//       reportingManager: manager._id,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//     });

//     await leave.save();

//     // 🔹 Update Attendance for all dates in range
//     let current = new Date(dateFrom);
//     const end = new Date(dateTo);

//     while (current <= end) {
//       await Attendance.findOneAndUpdate(
//         { employee: employee._id, date: current },
//         {
//           $set: {
//             dayStatus: "Leave",
//             leaveType,
//             leaveRef: leave._id,
//           },
//         },
//         { upsert: true, new: true }
//       );
//       current.setDate(current.getDate() + 1);
//     }

//     res.status(201).json({ message: "Leave applied successfully", leave });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

const Notification = require("./models/notificationSchema")
// app.post("/leave/apply", async (req, res) => {
//   try {
//     const { employeeId, leaveType, dateFrom, dateTo, duration, reason, reportingManagerId } = req.body;

//     const employee = await User.findById(employeeId);
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     const start = new Date(dateFrom);
//     const end = new Date(dateTo);
//     start.setHours(0, 0, 0, 0);
//     end.setHours(0, 0, 0, 0);

//     //  // ✅ Check if leave already exists on same or overlapping date range
//     //   const overlappingLeave = await Leave.findOne({
//     //     employee: employeeId,
//     //     status: { $ne: "rejected" }, // ignore rejected
//     //     $or: [
//     //       {
//     //         dateFrom: { $lte: end },
//     //         dateTo: { $gte: start },
//     //       },
//     //     ],
//     //   });

//     //   if (overlappingLeave) {
//     //     return res.status(400).json({
//     //       error:
//     //         "You already have a leave applied for one or more of these dates.",
//     //     });
//     //   }

//     const dayCount =
//       duration === "half"
//         ? 0.5
//         : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//     // ✅ Check balance before allowing
//     if (leaveType === "SL" && employee.sickLeaveBalance < dayCount) {
//       return res.status(400).json({ error: "No Sick Leave balance available. Please apply for LWP." });
//     }
//     if (leaveType === "CL" && employee.casualLeaveBalance < dayCount) {
//       return res.status(400).json({ error: "No Casual Leave balance available. Please apply for LWP." });
//     }

//     // Create new leave request
//     const leave = new Leave({
//       employee: employeeId,
//       leaveType,
//       dateFrom,
//       dateTo,
//       duration,
//       reason,
//       reportingManager: reportingManagerId,
//       status: "pending",
//       appliedAt: new Date(),
//     });

//     await leave.save();


//     // Notify reporting manager
//     if (reportingManagerId) {
//       await Notification.create({
//         user: reportingManagerId,
//         type: "Leave",
//         message: `New leave request from ${employee.name} (${new Date(dateFrom).toDateString()} - ${new Date(dateTo).toDateString()})`,
//         leaveRef: leave._id,
//       });
//     }

//     // Notify all admins
//     const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Leave",
//         message: `New leave request from ${employee.name} (${new Date(dateFrom).toDateString()} - ${new Date(dateTo).toDateString()})`,
//         leaveRef: leave._id,
//       });
//     }


//     res.json({ message: "Leave applied successfully!", leave });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

app.post("/leave/apply", async (req, res) => {
  try {
    const {
      employeeId,
      leaveType,
      dateFrom,
      dateTo,
      duration,
      reason,
      reportingManagerId,
    } = req.body;

    const employee = await User.findById(employeeId);
    if (!employee)
      return res.status(404).json({ error: "Employee not found" });

    const start = new Date(dateFrom);
    const end = new Date(dateTo);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const dayCount =
      duration === "half"
        ? 0.5
        : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // ✅ Check leave balance
    if (leaveType === "SL" && employee.sickLeaveBalance < dayCount) {
      return res.status(400).json({
        error: "No Sick Leave balance available. Please apply for LWP.",
      });
    }

    if (leaveType === "CL" && employee.casualLeaveBalance < dayCount) {
      return res.status(400).json({
        error: "No Casual Leave balance available. Please apply for LWP.",
      });
    }

    // normalize dates
start.setHours(0, 0, 0, 0);
end.setHours(23, 59, 59, 999);

// 🚫 BLOCK DUPLICATE LEAVE (pending / approved ONLY)
const overlappingLeave = await Leave.findOne({
  employee: employeeId,
  status: { $in: ["pending", "approved"] },
  dateFrom: { $lte: end },
  dateTo: { $gte: start },
});

if (overlappingLeave) {
  return res.status(400).json({
    error: "You already applied leave on this date.",
  });
}


    // ✅ Create leave request
    const leave = new Leave({
      employee: employeeId,
      leaveType,
      dateFrom,
      dateTo,
      duration,
      reason,
      reportingManager: reportingManagerId || null,
      status: "pending",
      appliedAt: new Date(),
    });

    await leave.save();

    // --------------------------------------------------
    // 🔔 NOTIFICATION LOGIC (FIXED)
    // --------------------------------------------------

    let notifyUsers = [];

    // 1️⃣ If manager exists → notify manager
    if (reportingManagerId) {
      notifyUsers.push(reportingManagerId);
    } 
    // 2️⃣ Else → notify default admin
    else {
      const defaultAdmin = await User.findOne({ role: "admin" });
      if (defaultAdmin) notifyUsers.push(defaultAdmin._id);
    }

    // 🔔 Notify manager OR fallback admin
    for (let userId of notifyUsers) {
      await Notification.create({
        user: userId,
        type: "Leave",
        message: `New leave request from ${employee.name} (${new Date(
          dateFrom
        ).toDateString()} - ${new Date(dateTo).toDateString()})`,
        leaveRef: leave._id,
        triggeredByRole: "EMPLOYEE", // ✅ ENUM MATCH
      });
    }

    // 3️⃣ Notify all admins (optional but kept)
    const admins = await User.find({
      role: { $in: ["admin", "hr", "ceo", "coo", "md"] },
    });

    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "Leave",
        message: `New leave request from ${employee.name} (${new Date(
          dateFrom
        ).toDateString()} - ${new Date(dateTo).toDateString()})`,
        leaveRef: leave._id,
        triggeredByRole: "EMPLOYEE",
      });
    }

    // --------------------------------------------------

    res.json({ message: "Leave applied successfully!", leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get latest notifications for a user
app.get("/notifications/:userId", async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.params.userId })
      .populate("leaveRef", "leaveType dateFrom dateTo status")
      .populate("regularizationRef", "date regularizationRequest.status")
      // .populate("eventRef", "name date description")
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notifications:", err); // <-- full error
    res.status(500).json({ error: err.message });
  }
});

//Mark Notification as Read
app.put("/notifications/:id/read", async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all leave requests for a manager
app.get("/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    const leaves = await Leave.find({ reportingManager: managerId })
      .populate("employee", "name email employeeId contact")
      .populate("reportingManager", "name email employeeId");

    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2. Get My Leaves (Employee)
app.get("/leave/my/:employeeId", async (req, res) => {
  try {
    const leaves = await Leave.find({ employee: req.params.employeeId }).sort({ date: -1 });
    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all leaves (Admin/HR)
app.get("/leaves", async (req, res) => {
  try {
    const leaves = await Leave.find()
      .populate("employee", "name email employeeId department")           // employee details
      .populate("reportingManager", "name email employeeId department")  // manager details
      .sort({ date: -1 });

    res.json(leaves);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all leaves assigned to a specific manager
app.get("/leaves/manager/:managerId", async (req, res) => {
  try {
    const { managerId } = req.params;

    const leaves = await Leave.find({ reportingManager: managerId })
      .populate("employee", "name email employeeId department")
      .populate("reportingManager", "name email employeeId department") // optional
      .sort({ createdAt: -1 });

    res.json(leaves);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// //manager/admin approve/reject
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, userId, role } = req.body; // role: "manager" or "admin"
//     const leaveId = req.params.leaveId;

//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     const employee = leave.employee;
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     // Manager can approve only their reporting leaves
//     if (role === "manager" && leave.reportingManager.toString() !== userId) {
//       return res.status(403).json({ error: "Not authorized" });
//     }

//     // Deduct leave only if approved and not already approved
//     if (status === "approved" && leave.status !== "approved") {
//       const start = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);
//       start.setHours(0, 0, 0, 0);
//       end.setHours(0, 0, 0, 0);

//       const dayCount =
//         leave.duration === "half"
//           ? 0.5
//           : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//       if (leave.leaveType === "SL") {
//         if (employee.sickLeaveBalance < dayCount)
//           return res.status(400).json({ error: "Not enough Sick Leave balance" });
//         employee.sickLeaveBalance -= dayCount;
//       } else if (leave.leaveType === "CL") {
//         if (employee.casualLeaveBalance < dayCount)
//           return res.status(400).json({ error: "Not enough Casual Leave balance" });
//         employee.casualLeaveBalance -= dayCount;
//       } else if (leave.leaveType === "LWP") {
//         employee.LwpLeave += dayCount;
//       }

//       // Update attendance for each leave date
//       let current = new Date(start);
//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: current },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//             },
//           },
//           { upsert: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }

//       employee.lastLeaveUpdate = new Date();
//       await employee.save();
//     }

//     // Update leave
//     leave.status = status;
//     leave.approvedBy = userId;
//     leave.approvedByRole = role; // ✅ only store role
//     await leave.save();

//     // ✅ Create notification for the employee
//     await Notification.create({
//       user: employee._id,
//       type: "Leave",
//       message: `Your leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status}.`,
//       leaveRef: leave._id,
//     });

//     // ✅ Notification for all admins
//     const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Leave",
//         message: `${employee.name}'s leave request (${new Date(leave.dateFrom).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
//         leaveRef: leave._id,
//       });
//     }

//     // Send response
//     return res.json({
//       message: `Leave ${status} successfully`,
//       leave,
//       employeeBalance: {
//         sickLeave: employee.sickLeaveBalance,
//         casualLeave: employee.casualLeaveBalance,
//         LwpLeave: employee.LwpLeave,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// Helper function to find sandwich days (weekends/holidays between leaves)
// 🥪 Helper function: Find sandwich leave days


// ------------------- MAIN ROUTE -------------------
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, userId, role } = req.body; // role: "manager" or "admin"
//     const leaveId = req.params.leaveId;

//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     const employee = leave.employee;
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     // ✅ Authorization check
//     if (role === "manager" && leave.reportingManager.toString() !== userId) {
//       return res.status(403).json({ error: "Not authorized" });
//     }

//     // ✅ Deduct leave only if approved and not already approved
//     if (status === "approved" && leave.status !== "approved") {
//       const start = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);
//       start.setHours(0, 0, 0, 0);
//       end.setHours(0, 0, 0, 0);

//       // base leave count
//       let dayCount =
//         leave.duration === "half"
//           ? 0.5
//           : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//       // 🥪 1. Get sandwich leave days (weekly off / holiday between)
//       const sandwichDays = await getSandwichDays(start, end);
//       const totalLeaveDays = dayCount + sandwichDays.length;

//       // 🥪 2. Deduct from balance (include sandwich days)
//       if (leave.leaveType === "SL") {
//         if (employee.sickLeaveBalance < totalLeaveDays)
//           return res.status(400).json({ error: "Not enough Sick Leave balance" });
//         employee.sickLeaveBalance -= totalLeaveDays;
//       } else if (leave.leaveType === "CL") {
//         if (employee.casualLeaveBalance < totalLeaveDays)
//           return res.status(400).json({ error: "Not enough Casual Leave balance" });
//         employee.casualLeaveBalance -= totalLeaveDays;
//       } else if (leave.leaveType === "LWP") {
//         employee.LwpLeave += totalLeaveDays;
//       }

//       // 🟢 3. Update attendance for each leave day
//       let current = new Date(start);
//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: current },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//               isSandwich: false,
//             },
//           },
//           { upsert: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }

//       // 🟣 4. Mark sandwich days as Leave
//       for (let day of sandwichDays) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: day },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//               isSandwich: true,
//             },
//           },
//           { upsert: true }
//         );
//       }

//       // 🟡 5. Save employee balance
//       employee.lastLeaveUpdate = new Date();
//       await employee.save();
//     }

//     // 🧾 Update leave status
//     leave.status = status;
//     leave.approvedBy = userId;
//     leave.approvedByRole = role;
//     await leave.save();

//     // 🔔 Notification for employee
//     await Notification.create({
//       user: employee._id,
//       type: "Leave",
//       message: `Your leave request (${new Date(
//         leave.dateFrom
//       ).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status}.`,
//       leaveRef: leave._id,
//     });

//     // 🔔 Notification for all admins
//     const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Leave",
//         message: `${employee.name}'s leave request (${new Date(
//           leave.dateFrom
//         ).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
//         leaveRef: leave._id,
//       });
//     }

//     // ✅ Response
//     return res.json({
//       message: `Leave ${status} successfully`,
//       leave,
//       employeeBalance: {
//         sickLeave: employee.sickLeaveBalance,
//         casualLeave: employee.casualLeaveBalance,
//         LwpLeave: employee.LwpLeave,
//       },
//     });
//   } catch (err) {
//     console.error("Error updating leave status:", err);
//     res.status(500).json({ error: err.message });
//   }
// });


// 🧩 Helper function — get all sandwich days (weekly off or holidays between leaves)
const getSandwichDays = async (start, end) => {
  const sandwichDays = [];
  const weeklyOffData = await WeeklyOff.findOne({ year: new Date().getFullYear() });

  let current = new Date(start);
  current.setDate(current.getDate() + 1); // start after fromDate
  const toDate = new Date(end);
  toDate.setDate(toDate.getDate() - 1); // end before toDate

  while (current <= toDate) {
    const day = current.getDay();
    const isSunday = day === 0;
    const isNthSaturday = weeklyOffData?.saturdays?.includes(Math.ceil(current.getDate() / 7));
    const isHoliday = weeklyOffData?.holidays?.some(
      (h) => new Date(h.date).toDateString() === current.toDateString()
    );

    if (isSunday || isNthSaturday || isHoliday) {
      sandwichDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return sandwichDays;
};

// 🟢 Main route — approve/reject leave with sandwich logic
app.put("/leave/:leaveId/status", async (req, res) => {
  try {
    const { status, userId, role } = req.body; // role: "manager" or "admin"
    const leaveId = req.params.leaveId;

    const leave = await Leave.findById(leaveId).populate("employee");
    if (!leave) return res.status(404).json({ error: "Leave not found" });

    const employee = leave.employee;
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    // ✅ Authorization check
    if (role === "manager" && leave.reportingManager?.toString() !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // ✅ Deduct leave only if newly approved
    if (status === "approved" && leave.status !== "approved") {
      const start = new Date(leave.dateFrom);
      const end = new Date(leave.dateTo);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      // Base leave count
      let dayCount =
        leave.duration === "half"
          ? 0.5
          : Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      // 🥪 1. Get sandwich days (weekly off / holidays between)
      const sandwichDays = await getSandwichDays(start, end);
      const totalLeaveDays = dayCount + sandwichDays.length;

      // 🟣 2. Deduct from balance (include sandwich days)
      if (leave.leaveType === "SL") {
        if (employee.sickLeaveBalance < totalLeaveDays)
          return res.status(400).json({ error: "Not enough Sick Leave balance" });
        employee.sickLeaveBalance -= totalLeaveDays;
      } else if (leave.leaveType === "CL") {
        if (employee.casualLeaveBalance < totalLeaveDays)
          return res.status(400).json({ error: "Not enough Casual Leave balance" });
        employee.casualLeaveBalance -= totalLeaveDays;
      } else if (leave.leaveType === "LWP") {
        employee.LwpLeave += totalLeaveDays;
      }

      // 🟢 3. Mark all leave dates in Attendance
      let current = new Date(start);
      while (current <= end) {
        await Attendance.findOneAndUpdate(
          { employee: employee._id, date: current },
          {
            $set: {
              dayStatus: "Leave",
              leaveType: leave.leaveType,
              leaveRef: leave._id,
              isSandwich: false,
            },
          },
          { upsert: true }
        );
        current.setDate(current.getDate() + 1);
      }

      // 🟠 4. Mark sandwich days as Leave (Sandwiched)
      for (let day of sandwichDays) {
        await Attendance.findOneAndUpdate(
          { employee: employee._id, date: day },
          {
            $set: {
              dayStatus: "Leave (Sandwiched)",
              leaveType: leave.leaveType,
              leaveRef: leave._id,
              isSandwich: true,
            },
          },
          { upsert: true }
        );
      }

      // 🟡 5. Save employee leave balance
      employee.lastLeaveUpdate = new Date();
      await employee.save();
    }

    // 🧾 Update leave status
    leave.status = status;
    leave.approvedBy = userId;
    leave.approvedByRole = role;
    await leave.save();

    // 🔔 Notification for employee
    await Notification.create({
      user: employee._id,
      type: "Leave",
      message: `Your leave request (${new Date(
        leave.dateFrom
      ).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status}.`,
      leaveRef: leave._id,
    });

    // 🔔 Notification for all admins
    const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "Leave",
        message: `${employee.name}'s leave request (${new Date(
          leave.dateFrom
        ).toDateString()} - ${new Date(leave.dateTo).toDateString()}) has been ${status} by ${role}.`,
        leaveRef: leave._id,
      });
    }

    // ✅ Response
    return res.json({
      message: `Leave ${status} successfully`,
      leave,
      employeeBalance: {
        sickLeave: employee.sickLeaveBalance,
        casualLeave: employee.casualLeaveBalance,
        LwpLeave: employee.LwpLeave,
      },
    });
  } catch (err) {
    console.error("Error updating leave status:", err);
    res.status(500).json({ error: err.message });
  }
});


// // Approve / Reject Leave
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, adminId } = req.body; // "approved" or "rejected"

//     // Find leave by ID and populate employee
//     const leave = await Leave.findById(req.params.leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     leave.status = status;
//     leave.approvedBy = adminId;

//     if (status === "approved") {
//       // Deduct leave balance
//       const deduction = leave.duration === "half" ? 0.5 : 1;

//       if (leave.leaveType === "SL") {
//         leave.employee.sickLeaveBalance =
//           (leave.employee.sickLeaveBalance || 0) - deduction;
//       } else if (leave.leaveType === "CL") {
//         leave.employee.casualLeaveBalance =
//           (leave.employee.casualLeaveBalance || 0) - deduction;
//       }

//       // Update last leave update
//       leave.employee.lastLeaveUpdate = new Date();

//       // Save updated employee
//       await leave.employee.save();

//       // Optionally, update attendance
//       await Attendance.findOneAndUpdate(
//         { employee: leave.employee._id, date: leave.date },
//         { status: "leave", leaveType: leave.leaveType, duration: leave.duration },
//         { upsert: true, new: true }
//       );
//     }

//     await leave.save();
//     res.json({ message: "Leave status updated and balance deducted", leave });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, adminId } = req.body; // "approved" | "rejected"

//     const leave = await Leave.findById(req.params.leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     leave.status = status;
//     leave.approvedBy = adminId;

//     if (status === "approved") {
//       // Deduct leave balance
//       const deduction = leave.duration === "half" ? 0.5 : 1;

//       if (leave.leaveType === "SL") {
//         leave.employee.sickLeaveBalance =
//           (leave.employee.sickLeaveBalance || 0) - deduction;
//       } else if (leave.leaveType === "CL") {
//         leave.employee.casualLeaveBalance =
//           (leave.employee.casualLeaveBalance || 0) - deduction;
//       }

//       leave.employee.lastLeaveUpdate = new Date();
//       await leave.employee.save();

//       // 🔹 Update attendance for the full leave range
//       let current = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);

//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: leave.employee._id, date: current },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//             },
//           },
//           { upsert: true, new: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }
//     }

//     await leave.save();
//     res.json({ message: "Leave status updated and balance deducted", leave });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });
// Update leave status and deduct leave balance
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, adminId } = req.body;
//     const leaveId = req.params.leaveId;

//     // Fetch leave with employee populated
//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     // Only handle approved status deduction
//     if (status === "approved") {
//       const deduction = leave.duration === "half" ? 0.5 : 1;

//       // Fetch latest employee document
//       const employee = await User.findById(leave.employee._id);
//       if (!employee) return res.status(404).json({ error: "Employee not found" });

//       // Deduct leave based on leave type
//       if (leave.leaveType === "SL") {
//         if (employee.sickLeaveBalance < deduction)
//           return res.status(400).json({ error: "Not enough Sick Leave balance" });
//         employee.sickLeaveBalance -= deduction;
//       } else if (leave.leaveType === "CL") {
//         if (employee.casualLeaveBalance < deduction)
//           return res.status(400).json({ error: "Not enough Casual Leave balance" });
//         employee.casualLeaveBalance -= deduction;
//       } else if (leave.leaveType === "LWP") {
//         // For Leave Without Pay, you may track separately if needed
//         employee.LwpLeave += deduction;
//       }

//       employee.lastLeaveUpdate = new Date();
//       await employee.save();

//       // Update attendance for the leave range
//       let current = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);

//       // Normalize dates (set hours to 0 to avoid time issues)
//       current.setHours(0, 0, 0, 0);
//       end.setHours(0, 0, 0, 0);

//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: current },
//           {
//             $set: {
//               dayStatus: "Leave",
//               leaveType: leave.leaveType,
//               leaveRef: leave._id,
//             },
//           },
//           { upsert: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }

//       // Update leave document
//       leave.status = "approved";
//       leave.approvedBy = adminId;
//       await leave.save();

//       return res.json({
//         message: "Leave status updated and balance deducted",
//         leave,
//         employeeBalance: {
//           sickLeave: employee.sickLeaveBalance,
//           casualLeave: employee.casualLeaveBalance,
//           LwpLeave: employee.LwpLeave,
//         },
//       });
//     } else {
//       // Handle other statuses like rejected
//       leave.status = status;
//       leave.approvedBy = adminId;
//       await leave.save();

//       return res.json({ message: "Leave status updated", leave });
//     }
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, adminId } = req.body;
//     const leaveId = req.params.leaveId;

//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });
// if (status === "approved") {
//   // Calculate total number of days including start and end
//   const start = new Date(leave.dateFrom);
//   const end = new Date(leave.dateTo);
//   start.setHours(0, 0, 0, 0);
//   end.setHours(0, 0, 0, 0);

//   // total days between start and end
//   let totalDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

//   // Adjust for half-day leave
//   if (leave.duration === "half") totalDays = 0.5;

//   const employee = await User.findById(leave.employee._id);
//   if (!employee) return res.status(404).json({ error: "Employee not found" });

//   // Convert balances to numbers just in case
//   employee.sickLeaveBalance = Number(employee.sickLeaveBalance);
//   employee.casualLeaveBalance = Number(employee.casualLeaveBalance);
//   employee.LwpLeave = Number(employee.LwpLeave);

//   if (leave.leaveType === "SL") {
//     if (employee.sickLeaveBalance < totalDays)
//       return res.status(400).json({ error: "Not enough Sick Leave balance" });
//     employee.sickLeaveBalance -= totalDays;
//   } else if (leave.leaveType === "CL") {
//     if (employee.casualLeaveBalance < totalDays)
//       return res.status(400).json({ error: "Not enough Casual Leave balance" });
//     employee.casualLeaveBalance -= totalDays;
//   } else if (leave.leaveType === "LWP") {
//     employee.LwpLeave += totalDays;
//   }

//   await employee.save();

//   // Update attendance for each day
//   let current = new Date(start);
//   while (current <= end) {
//     await Attendance.findOneAndUpdate(
//       { employee: employee._id, date: current },
//       { $set: { dayStatus: "Leave", leaveType: leave.leaveType, leaveRef: leave._id } },
//       { upsert: true }
//     );
//     current.setDate(current.getDate() + 1);
//   }

//   leave.status = "approved";
//   leave.approvedBy = adminId;
//   await leave.save();

//   return res.json({
//     message: `Leave approved and ${totalDays} day(s) deducted from balance`,
//     leave,
//     employeeBalance: {
//       sickLeave: employee.sickLeaveBalance,
//       casualLeave: employee.casualLeaveBalance,
//       LwpLeave: employee.LwpLeave,
//     },
//   });
// }

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });
// app.put("/leave/:leaveId/status", async (req, res) => {
//   try {
//     const { status, userId, role } = req.body; // userId can be manager or admin
//     const leaveId = req.params.leaveId;

//     const leave = await Leave.findById(leaveId).populate("employee");
//     if (!leave) return res.status(404).json({ error: "Leave not found" });

//     const employee = await User.findById(leave.employee._id);
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     // Only deduct if status is approved and was not already approved
//     if (status === "approved" && leave.status !== "approved") {
//       const start = new Date(leave.dateFrom);
//       const end = new Date(leave.dateTo);
//       start.setHours(0,0,0,0);
//       end.setHours(0,0,0,0);

//       const dayCount = leave.duration === "half"
//         ? 0.5
//         : Math.ceil((end - start) / (1000*60*60*24)) + 1;

//       if (leave.leaveType === "SL") {
//         if (employee.sickLeaveBalance < dayCount)
//           return res.status(400).json({ error: "Not enough Sick Leave balance" });
//         employee.sickLeaveBalance -= dayCount;
//       } else if (leave.leaveType === "CL") {
//         if (employee.casualLeaveBalance < dayCount)
//           return res.status(400).json({ error: "Not enough Casual Leave balance" });
//         employee.casualLeaveBalance -= dayCount;
//       } else if (leave.leaveType === "LWP") {
//         employee.LwpLeave += dayCount;
//       }

//       // Update attendance
//       let current = new Date(start);
//       while (current <= end) {
//         await Attendance.findOneAndUpdate(
//           { employee: employee._id, date: current },
//           { $set: { dayStatus: "Leave", leaveType: leave.leaveType, leaveRef: leave._id } },
//           { upsert: true }
//         );
//         current.setDate(current.getDate() + 1);
//       }

//       employee.lastLeaveUpdate = new Date();
//       await employee.save();
//     }

//     // Update leave document
//     leave.status = status;
//     leave.approvedBy = userId;
//     leave.approvedByRole = role; // "manager" or "admin"
//     await leave.save();

//     return res.json({
//       message: `Leave ${status} and balance updated`,
//       leave,
//       employeeBalance: {
//         sickLeave: employee.sickLeaveBalance,
//         casualLeave: employee.casualLeaveBalance,
//         LwpLeave: employee.LwpLeave,
//       }
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

//---------------------------empoyee apply for leave and admin granted for this leave done

//-----------------regularization concept----------------
// Get pending regularization requests for the current month
// Employee applies regularization request
// app.post("/attendance/regularization/apply", async (req, res) => {
//   try {
//     const { employeeId, date, requestedCheckIn, requestedCheckOut } = req.body;

// if (!employeeId) {
//     return res.status(400).json({ error: "Employee ID is required" });
// }
// console.log(employeeId)
// // Ensure date is valid
// const targetDate = new Date(date);
// targetDate.setHours(0, 0, 0, 0);

// // Find or create attendance for this employee & date
// let attendance = await Attendance.findOne({ employee: employeeId, date: targetDate });

// if (!attendance) {
//     attendance = new Attendance({ employee: employeeId, date: targetDate, dayStatus: "Absent" });
// }

// // Set regularization request
// let checkInDate = requestedCheckIn ? new Date(`${date}T${requestedCheckIn}`) : null;
// let checkOutDate = requestedCheckOut ? new Date(`${date}T${requestedCheckOut}`) : null;

// attendance.regularizationRequest = {
//     checkIn: checkInDate,
//     checkOut: checkOutDate,
//     status: "Pending",
//     requestedAt: new Date(),
// };

// await attendance.save();
// res.json({ message: "Regularization request submitted", attendance });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

//working
// app.post("/attendance/regularization/apply", async (req, res) => {
//   try {
//     const { employeeId, date, requestedCheckIn, requestedCheckOut } = req.body;

//     if (!employeeId) {
//       return res.status(400).json({ error: "Employee ID is required" });
//     }

//     if (!date) {
//       return res.status(400).json({ error: "Date is required" });
//     }

//     // Normalize date (00:00:00)
//     const targetDate = new Date(date);
//     targetDate.setHours(0, 0, 0, 0);

//     // Convert requested times into full Date objects
//     const checkInDate = requestedCheckIn
//       ? new Date(`${date}T${requestedCheckIn}`)
//       : null;
//     const checkOutDate = requestedCheckOut
//       ? new Date(`${date}T${requestedCheckOut}`)
//       : null;

//     // ✅ Upsert logic (no duplicates)
//     let attendance = await Attendance.findOneAndUpdate(
//       { employee: employeeId, date: targetDate },
//       {
//         $setOnInsert: {
//           employee: employeeId,
//           date: targetDate,
//           dayStatus: "Absent",
//         },
//         $set: {
//           regularizationRequest: {
//             checkIn: checkInDate,
//             checkOut: checkOutDate,
//             status: "Pending",
//             requestedAt: new Date(),
//           },
//         },
//       },
//       { new: true, upsert: true }
//     );

//     res.json({
//       message: "Regularization request submitted",
//       attendance,
//     });
//   } catch (err) {
//     console.error("Error applying regularization:", err);
//     res.status(500).json({ error: err.message });
//   }
// });

// app.post("/attendance/regularization/apply", async (req, res) => {
//   try {
//     const { employeeId, date, requestedCheckIn, requestedCheckOut, mode  } = req.body;

//     console.log("checkin/checkout : ", requestedCheckIn, requestedCheckOut,mode )

//     if (!employeeId) return res.status(400).json({ error: "Employee ID is required" });
//     if (!date) return res.status(400).json({ error: "Date is required" });

//     // Normalize date (00:00:00)
//     const targetDate = new Date(date);
//     targetDate.setHours(0, 0, 0, 0);

//     // Convert requested times into full Date objects
//     const checkInDate = requestedCheckIn ? new Date(`${date}T${requestedCheckIn}`) : null;
//     const checkOutDate = requestedCheckOut ? new Date(`${date}T${requestedCheckOut}`) : null;

//     // Fetch employee to get reporting manager
//     const employee = await User.findById(employeeId);
//     if (!employee) return res.status(404).json({ error: "Employee not found" });

//     const managerId = employee.reportingManager;
//     console.log("managerid", managerId)
//     // Upsert logic (no duplicates)
//     const attendance = await Attendance.findOneAndUpdate(
//       { employee: employeeId, date: targetDate },
//       {
//         $setOnInsert: {
//           employee: employeeId,
//           date: targetDate,
//           dayStatus: "Absent",
//         },
//         $set: {
//            mode: mode || "Office",
//           regularizationRequest: {
//             checkIn: checkInDate,
//             checkOut: checkOutDate,
//             status: "Pending",
//             requestedAt: new Date(),
//             reportingManager: managerId, // assign manager
//           },
//         },
//       },
//       { new: true, upsert: true }
//     );

//     // ✅ Notify manager
//     if (managerId) {
//       await Notification.create({
//         user: managerId,
//         type: "Regularization",
//         message: `New regularization request from ${employee.name} for ${targetDate.toDateString()}`,
//         regularizationRef: attendance._id,
//       });
//     }

//     // ✅ Notify all admins
//     const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
//     for (let admin of admins) {
//       await Notification.create({
//         user: admin._id,
//         type: "Regularization",
//         message: `New regularization request from ${employee.name} for ${targetDate.toDateString()}`,
//         regularizationRef: attendance._id,
//       });
//     }

//     res.json({ message: "Regularization request submitted", attendance });
//   } catch (err) {
//     console.error("Error applying regularization:", err);
//     res.status(500).json({ error: err.message });
//   }
// });





app.post("/attendance/regularization/apply", async (req, res) => {
  try {
    const { employeeId, date, requestedCheckIn, requestedCheckOut, mode,reason } = req.body;
    console.log("checkin/checkout:", requestedCheckIn, requestedCheckOut, mode);

    if (!employeeId) return res.status(400).json({ error: "Employee ID is required" });
    if (!date) return res.status(400).json({ error: "Date is required" });

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // ✅ Convert plain times to proper UTC times (from IST)
    function toISTDate(dateStr, timeStr) {
      if (!dateStr || !timeStr) return null;
      const [hours, minutes] = timeStr.split(":");
      if (isNaN(hours) || isNaN(minutes)) return null;
      const utcDate = new Date(dateStr);
      utcDate.setUTCHours(hours - 5, minutes - 30, 0, 0); // Convert IST → UTC
      return utcDate;
    }

    const checkInDate = toISTDate(date, requestedCheckIn);
    const checkOutDate = toISTDate(date, requestedCheckOut);

    // Validate
    if (!checkInDate || !checkOutDate || isNaN(checkInDate) || isNaN(checkOutDate)) {
      return res.status(400).json({ error: "Invalid check-in or check-out time" });
    }

    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const managerId = employee.reportingManager;
    console.log("managerId:", managerId);

    const attendance = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: targetDate },
      {
        $setOnInsert: {
          employee: employeeId,
          date: targetDate,
          dayStatus: "Absent",
        },
        $set: {
          mode: mode || "Office",
          regularizationRequest: {
            checkIn: checkInDate,
            checkOut: checkOutDate,
            status: "Pending",
            reason:reason,
            requestedAt: new Date(),
            reportingManager: managerId,
          },
        },
      },
      { new: true, upsert: true }
    );

    // Notify manager + admins
    if (managerId) {
      await Notification.create({
        user: managerId,
        type: "Regularization",
        message: `New regularization request from ${employee.name} for ${targetDate.toDateString()}`,
        regularizationRef: attendance._id,
      });
    }

    const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
    for (const admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "Regularization",
        message: `New regularization request from ${employee.name} for ${targetDate.toDateString()}`,
        regularizationRef: attendance._id,
      });
    }

    res.json({ message: "Regularization request submitted", attendance });
  } catch (err) {
    console.error("Error applying regularization:", err);
    res.status(500).json({ error: err.message });
  }
});



// Get all regularization requests for a manager
// Get all regularization requests assigned to a manager
// GET regularization requests for manager
app.get("/regularization/manager/:managerId", async (req, res) => {
  const { managerId } = req.params;

  try {
    // Find all attendance records where employee's reportingManager is this manager
    const records = await Attendance.find({
      "regularizationRequest.status": { $in: ["Pending", "Approved", "Rejected"] },
    })
      .populate({
        path: "employee",
        match: { reportingManager: managerId }, // Only employees reporting to this manager
      });

    // Filter out null employees (not reporting to this manager)
    const filteredRecords = records.filter((r) => r.employee);

    res.json(filteredRecords);
  } catch (err) {
    console.error("Error fetching regularization for manager:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/attendance/regularization/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approvedBy, approvedByRole, approvedByName } = req.body;

    const attendance = await Attendance.findById(id);
    if (!attendance) return res.status(404).json({ error: "Attendance not found" });

    attendance.regularizationRequest.status = status;
    attendance.regularizationRequest.reviewedAt = new Date();
    attendance.regularizationRequest.approvedBy = approvedBy;
    attendance.regularizationRequest.approvedByRole = approvedByRole;
    attendance.regularizationRequest.approvedByName = approvedByName;

    await attendance.save();

    // ✅ Create notification for employee
    await Notification.create({
      user: attendance.employee._id,
      type: "Regularization",
      message: `Your regularization request for ${attendance.date.toDateString()} has been ${status}.`,
      regularizationRef: attendance._id,
    });

    res.json({ message: "Status updated successfully", attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get My Regularization Requests (Employee) with employee name
app.get("/attendance/regularization/my/:employeeId", async (req, res) => {
  try {
    const employeeId = req.params.employeeId;

    // Find all attendance documents for this employee where regularizationRequest exists
    const requests = await Attendance.find({
      employee: employeeId,
      "regularizationRequest": { $exists: true, $ne: {} }
    })
      .sort({ date: -1 }) // most recent first
      .populate("employee", "name"); // populate only the 'name' field

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get all regularizations for all employees
app.get("/attendance/regularization/all", authenticate, async (req, res) => {
  try {
    const records = await Attendance.find({
      "regularizationRequest": { $exists: true, $ne: null }
    })
      .populate("employee", "name email employeeId") // fetch employee details
      .sort({ date: -1 });

    res.json(records);
  } catch (err) {
    console.error("Fetch all regularizations error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//get all leave and regularization to admin
app.get("/leaves-and-regularizations", authenticate, async (req, res) => {
  try {
    // Only admin can access
    if (req.user.role !== "admin" && req.user.role !== "ceo" && req.user.role !== "hr") {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    // ✅ Fetch all leaves
    const leaves = await Leave.find()
      .populate("employee", "name email employeeId department")
      .sort({ fromDate: -1 });

    // ✅ Fetch all regularizations
    const regularizations = await Attendance.find({
      "regularizationRequest": { $exists: true, $ne: null }
    })
      .populate("employee", "name email employeeId department")
      .sort({ date: -1 });

    // ✅ Return both in single response
    res.json({
      leaves,
      regularizations,
    });
  } catch (err) {
    console.error("Error fetching leaves & regularizations:", err);
    res.status(500).json({ error: err.message });
  }
});

// Approve / Reject Regularization=admin
app.put("/attendance/regularization/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body; // "Approved" or "Rejected"
    const { id } = req.params;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const record = await Attendance.findById(id).populate("employee", "name");

    if (!record) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    if (!record.regularizationRequest) {
      return res.status(400).json({ message: "No regularization request found" });
    }

    // Update status
    record.regularizationRequest.status = status;

    // If Approved → mark as Present and recalculate working hours
    if (status === "Approved") {
      record.checkIn = record.regularizationRequest.checkIn;
      record.checkOut = record.regularizationRequest.checkOut;

      const diffMs = record.checkOut - record.checkIn;
      record.workingHours = diffMs / (1000 * 60 * 60);

      record.dayStatus = record.workingHours >= 7.5 ? "Present" : "Half Day";
    }

    // If Rejected → mark as Absent
    if (status === "Rejected") {
      record.dayStatus = "Absent";
    }

    await record.save();

    // 1️⃣ Notify employee
    await Notification.create({
      user: record.employee._id,
      type: "Regularization",
      message: `Your regularization request for ${record.date.toDateString()} has been ${status}.`,
      regularizationRef: record._id,
    });

    // 2️⃣ Notify admin(s)
    const admins = await User.find({ role: { $in: ["admin", "hr", "ceo"] } });
    for (let admin of admins) {
      await Notification.create({
        user: admin._id,
        type: "Regularization",
        message: `${record.employee.name}'s regularization request for ${record.date.toDateString()} has been ${status}.`,
        regularizationRef: record._id,
      });
    }

    res.json({ message: `Regularization ${status}`, record });
  } catch (err) {
    console.error("Update regularization error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE regularization request=admin can delete
app.delete("/attendance/regularization/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Attendance.findByIdAndDelete(id);
    res.status(200).json({ message: "Regularization request deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Failed to delete request" });
  }
});




//my attendane
app.get("/attendance/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const records = await Attendance.find({ employee: employeeId })
      .populate("employee", "name email employeeId department") // employee details
      .populate("leaveRef", "leaveType duration status appliedAt approvedBy") // leave details
      .sort({ date: -1 }); // latest first

    res.status(200).json(records);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: err.message });
  }
});





const Event = require("./models/EventSchema")
// Add new holiday
// app.post("/addEvent", async (req, res) => {
//   try {
//     const { name, date, description } = req.body;
//     console.log(req.body)
//     const event = new Event({ name, date, description });


//     await event.save();
//     // 2️⃣ Fetch all users (employee, manager, hr, admin)
//     const users = await User.find({}); // fetch all users

//     // 3️⃣ Create notifications for all users
//     const notifications = users.map(user => ({
//       user: user._id,
//       type: "Event",
//       message: `New event "${name}" scheduled on ${new Date(date).toDateString()}`,
//       eventRef: event._id,
//     }));

//     await Notification.insertMany(notifications);

//     res.status(201).json({ event, message: "Event created and notifications sent to all employees." });
//   } catch (err) {
//     res.status(500).json({ error: "Failed to create holiday" });
//   }
// });

app.post("/addEvent", async (req, res) => {
  try {
    const { name, date, description } = req.body;

    // 🔍 Check for duplicate event
    const existingEvent = await Event.findOne({
      name: name.trim(),
      date,
    });

    if (existingEvent) {
      return res.status(409).json({
        message: "Event already exists for the selected date.",
      });
    }

    // ✅ Create new event
    const event = new Event({ name: name.trim(), date, description });
    await event.save();

    // Fetch all users
    const users = await User.find({});

    // Create notifications
    const notifications = users.map((user) => ({
      user: user._id,
      type: "Event",
      message: `New event "${name}" scheduled on ${new Date(date).toDateString()}`,
      eventRef: event._id,
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      event,
      message: "Event created and notifications sent to all employees.",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to create event" });
  }
});


//admin can delete events
// Delete holiday
app.delete("/events/:id", async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete Event" });
    console.log(err)
  }
});

// Get all events for employee, including birthdays, anniversaries, and custom events
app.get("/events-for-employee", authenticate, async (req, res) => {
  try {
    const today = new Date();

    // Employee birthdays & anniversaries
    const employees = await User.find({}, "name dob doj");
    const employeeEvents = employees
      .map(emp => {
        const dob = new Date(emp.dob);
        let nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);

        const doj = new Date(emp.doj);
        let nextAnniversary = new Date(today.getFullYear(), doj.getMonth(), doj.getDate());
        if (nextAnniversary < today) nextAnniversary.setFullYear(today.getFullYear() + 1);

        return [
          { type: "Birthday", name: emp.name, date: nextBirthday },
          { type: "Anniversary", name: emp.name, date: nextAnniversary },
        ];
      })
      .flat();

    // Custom events from Event collection
    const customEvents = await Event.find({}, "name date description _id").sort({ date: 1 });
    const mappedCustomEvents = customEvents.map(ev => ({
      _id: ev._id,
      type: "Event",
      name: ev.name,
      date: new Date(ev.date),
      description: ev.description || "",
    }));

    // Combine all events and sort by date
    const allEvents = [...employeeEvents, ...mappedCustomEvents].sort((a, b) => a.date - b.date);

    res.json(allEvents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch events." });
  }
});



//assign reporting manager 
// GET all users with role 'manager'
app.get("/managers", async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" }).select(
      "_id name email designation profile department"
    );
    res.status(200).json(managers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch managers" });
  }
});

// Assign reporting manager
// Assign reporting manager
// Assign reporting manager
// app.put("/users/:employeeId/assign-manager", async (req, res) => {
//   try {
//     const { employeeId } = req.params;
//     const { managerId } = req.body; // should be just the manager's _id

//     if (!managerId) {
//       return res.status(400).json({ error: "Manager ID is required" });
//     }

//     const manager = await User.findById(managerId);
//     if (!manager) {
//       return res.status(404).json({ error: "Manager not found" });
//     }

//     // const employee = await User.findByIdAndUpdate(
//     //   employeeId,
//     //   { reportingManager: manager._id },
//     //   { new: true }
//     // ).populate("reportingManager", "_id name email designation role department profile"); // optional populate
// await User.findByIdAndUpdate(employeeId, { reportingManager: manager._id });

// const employee = await User.findById(employeeId)
//   .populate("reportingManager", "name email contact designation role department profile");


//     res.status(200).json({ message: "Manager assigned successfully", employee });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });
// //get manager employee data
// app.get("/employees/:id", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).populate(
//       "reportingManager",
//       "_id name email designation role department"
//     );

//     if (!user) return res.status(404).json({ error: "User not found" });
//     res.json(user);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

app.put("/users/:employeeId/assign-manager", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { managerId } = req.body;

    if (!managerId) {
      return res.status(400).json({ error: "Manager ID is required" });
    }

    // check if manager exists
    const manager = await User.findById(managerId);
    if (!manager) {
      return res.status(404).json({ error: "Manager not found" });
    }

    // assign manager
    await User.findByIdAndUpdate(employeeId, { reportingManager: manager._id });

    // fetch employee with populated manager info
    const employee = await User.findById(employeeId).populate(
      "reportingManager",
      "_id name email contact designation role department image employeeId"
    );

    res.status(200).json({ message: "Manager assigned successfully", employee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/employees/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate(
      "reportingManager",
      "_id name email contact designation role department image employeeId"
    );

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


app.get("/leaves/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const records = await Attendance.find({ employee: employeeId })
      .populate("leaveRef") // populate leave details
      .sort({ date: 1 });

    res.json(records);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//delete leave/withdraw leave
app.delete("/leave/:id", async (req, res) => {
  try {
    const leave = await Leave.findByIdAndDelete(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave not found" });

    res.json({ message: "Leave deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



















const Holiday = require('./models/HolidaysSchema')
//holidays calender
// Get all holidays
app.get("/getHolidays", async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

// // Add new holiday
// app.post("/holidays", async (req, res) => {
//   try {
//     const { name, date, description } = req.body;
//     console.log(req.body)
//     const holiday = new Holiday({ name, date, description });
//     await holiday.save();
//     res.status(201).json(holiday);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to create holiday" });
//   }
// });

// Add new holiday
app.post("/holidays", async (req, res) => {
  try {
    const { name, date, description } = req.body;

    // 🔴 Check for duplicate holiday on same date
    const existingHoliday = await Holiday.findOne({
      date: new Date(date),
    });

    if (existingHoliday) {
      return res.status(400).json({
        error: "Holiday already exists for this date",
      });
    }

    const holiday = new Holiday({ name, date, description });
    await holiday.save();

    // notification code
    const users = await User.find({});

   const notifications = users.map((user) => ({
  user: user._id,
  type: "Holiday",
  message: `New Holiday "${name}" scheduled on ${new Date(date).toDateString()}`,
  holidayRef: holiday._id,
  triggeredByRole: "Admin", // ✅ ADD THIS
}));


    await Notification.insertMany(notifications);

    res.status(201).json(holiday);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create holiday" });
  }
});

// Delete holiday
app.delete("/holidays/:id", async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: "Holiday deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});











// //weekly off
// const WeeklyOff = require("./models/WeeklyOffSchema");


// app.post("/admin/weeklyoff", async (req, res) => {
//   const { year, saturdays } = req.body;

//   try {
//     // Update if exists, otherwise create
//     const updated = await WeeklyOff.findOneAndUpdate(
//       { year },
//       { saturdays },
//       { upsert: true, new: true }
//     );

//     res.status(201).json({
//       status: 201,
//       message: "Weekly off updated successfully",
//       data: updated
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: 500, message: "Something went wrong" });
//   }
// });
// app.get("/admin/weeklyoff/:year", async (req, res) => {
//   const { year } = req.params;
//   try {
//     const config = await WeeklyOff.findOne({ year: parseInt(year) });
//     res.status(200).json({ status: 200, data: config || { saturdays: [] } });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ status: 500, message: "Something went wrong" });
//   }
// });

const WeeklyOff = require("./models/WeeklyOffSchema");

// Save or update weekly off config
app.post("/admin/weeklyoff", async (req, res) => {
  const { year, saturdays } = req.body;
  console.log("teat sat", year, saturdays)

  try {
    if (!year || !Array.isArray(saturdays)) {
      return res.status(400).json({ message: "Invalid input format" });
    }

    const updated = await WeeklyOff.findOneAndUpdate(
      { year },
      { saturdays },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: "Weekly off updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error saving weekly off:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});

// Get weekly off for a given year
app.get("/admin/weeklyoff/:year", async (req, res) => {
  const { year } = req.params;

  try {
    const config = await WeeklyOff.findOne({ year: parseInt(year) });
    res.status(200).json({
      success: true,
      data: config || { saturdays: [] },
    });
  } catch (err) {
    console.error("Error fetching weekly off:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
});



//notification to user 

// app.get("/notifications/:userId", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.userId);

//     let notifications = [];
//     if (user.role === "manager" || user.role === "admin") {
//       notifications = await Notification.find({ user: req.params.userId })
//         .populate("leaveRef", "leaveType dateFrom dateTo status")
//         .populate("regularizationRef", "date regularizationRequest.status")
//         .populate("eventRef", "name date description")
//         .sort({ createdAt: -1 });
//     }

//     res.json(notifications);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch notifications" });
//   }
// });


// app.get("/notifications/:userId", async (req, res) => {
//   try {
//     // Fetch notifications for any user role
//     const notifications = await Notification.find({ user: req.params.userId })
//       .populate("leaveRef", "leaveType dateFrom dateTo status")
//       .populate("regularizationRef") // populate full attendance document
//       .populate("eventRef", "name date description")
//       .sort({ createdAt: -1 });

//     res.json(notifications);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to fetch notifications" });
//   }
// });

app.get("/notifications/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    let notifications = [];

    if (user.role === "manager" || user.role === "admin" || user.role === "hr" || user.role === "ceo") {
      // HR, Manager, Admin → fetch all notifications
      notifications = await Notification.find({})
        .populate("leaveRef", "leaveType dateFrom dateTo status")
        .populate("regularizationRef", "date regularizationRequest.status")
        .populate("eventRef", "name date description")
        .sort({ createdAt: -1 });
    } else {
      // Employees → only their own notifications
      notifications = await Notification.find({ user: req.params.userId })
        .populate("leaveRef", "leaveType dateFrom dateTo status")
        .populate("regularizationRef", "date regularizationRequest.status")
        .populate("eventRef", "name date description")
        .sort({ createdAt: -1 });
    }

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});



















// GET single employee
app.get('/getEmployee/:id', async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).populate('reportingManager', 'name email designation');
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



app.get("/attendance/employee/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const attendanceRecords = await Attendance.find({ employee: id }).sort({
      date: -1,
    });
    res.json(attendanceRecords);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch employee attendance" });
  }
});

// ✅ Get all attendance records of a particular employee
app.get("/attendance/all/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Validate ObjectId
    if (!employeeId || !employeeId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    // Fetch records
    const records = await Attendance.find({ employee: employeeId })
      .populate("employee", "name email department role")
      .sort({ date: -1 });

    if (!records || records.length === 0) {
      return res.status(404).json({ message: "No attendance records found" });
    }

    res.status(200).json(records);
  } catch (err) {
    console.error("Error fetching employee attendance:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});





// edit myprofile delete proffile image
app.delete("/employees/:id/image", async (req, res) => {
  try {
    const { id } = req.params;
    const field = req.query.field || "image";

    const employee = await User.findById(id);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    // get the current URL depending on field (passbook stored in bankDetails)
    let fileUrl;
    if (field === "passbookPdf") {
      fileUrl = employee.bankDetails?.passbookPdf;
    } else {
      fileUrl = employee[field];
    }

    if (!fileUrl) return res.status(404).json({ error: "No file found for that field" });

    // Helper to extract Cloudinary public_id from URL:
    const getCloudinaryPublicId = (url) => {
      try {
        // Matches: .../upload/(v1234/)?<public_id>.<ext>
        const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
        return m ? decodeURIComponent(m[1]) : null;
      } catch (e) {
        return null;
      }
    };

    // If Cloudinary configured, attempt to delete remote file
    let cloudinaryDeleted = false;
    if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      const publicId = getCloudinaryPublicId(fileUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
          cloudinaryDeleted = true;
        } catch (err) {
          console.warn("Cloudinary deletion failed for", publicId, err.message || err);
          // We do not abort — still remove DB reference below
        }
      }
    }

    // Remove URL from employee object
    if (field === "passbookPdf") {
      if (employee.bankDetails) {
        employee.bankDetails.passbookPdf = undefined;
      }
    } else {
      employee[field] = undefined;
    }

    await employee.save();

    return res.json({
      message: "File removed from employee record",
      field,
      cloudinaryDeleted,
    });
  } catch (err) {
    console.error("Error deleting employee image:", err);
    return res.status(500).json({ error: "Server error" });
  }
});









// leave withdraw : Adesh code
app.delete("/deleteleave/leave/:id", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    session.startTransaction();
    console.log("id", id)
    const leave = await Leave.findById(id).session(session);
    if (!leave) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: "Leave not found" });
    }

    if ((leave.status || "").toLowerCase() !== "pending") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: "Only pending leaves can be deleted" });
    }

    // delete the leave
    const deleteRes = await Leave.deleteOne({ _id: leave._id }).session(session);
    console.log("delete", deleteRes)

    // build robust filter for leaveRef (cover both stored ObjectId and string cases)
    const notifFilter = (() => {
      if (Types.ObjectId.isValid(id)) {
        return { leaveRef: { $in: [new Types.ObjectId(id), id] } };
      }
      return { leaveRef: id };
    })();
    console.log("notifFilter", notifFilter)

    const notifRes = await Notification.deleteMany(notifFilter).session(session);
    console.log("delete notification:", notifRes)
    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Leave (pending) deleted successfully",
      leaveDeleted: deleteRes.deletedCount || 0,
      notificationsDeleted: notifRes.deletedCount || 0,
    });
  } catch (err) {
    try { await session.abortTransaction(); } catch (e) { }
    session.endSession();
    console.error("Error deleting leave + notifications:", err);
    return res.status(500).json({ error: err.message });
  }
});



//adesh code- employeesetting
app.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const id = req.user._id;  // from JWT token

    console.log(id)
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);


    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;


    user.refreshToken = null;
    user.verifytoken = null;

    await user.save();

    return res.json({
      success: true,
      message: "Password updated successfully",
    });

  } catch (err) {
    console.error("Error changing password:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});



// app.get("/attendance/manager/:managerId/today", async (req, res) => {
//   try {
//     const { managerId } = req.params;

//     // 1) Validate managerId
//     if (!managerId || !managerId.match(/^[0-9a-fA-F]{24}$/)) {
//       return res.status(400).json({ message: "Invalid manager ID" });
//     }

//     // 2) Find all employees who report to this manager
//     const employees = await User.find(
//       { reportingManager: managerId },
//       "_id name email department role employeeId reportingManager"
//     );

//     if (!employees.length) {
//       return res.status(200).json({ employees: [] });
//     }

//     const employeeIds = employees.map((e) => e._id);

//     // 3) Build "today" range
//     const startOfToday = new Date();
//     startOfToday.setHours(0, 0, 0, 0);

//     const endOfToday = new Date();
//     endOfToday.setHours(23, 59, 59, 999);

//     // 4) Fetch today's attendance for those employees
//     const records = await Attendance.find({
//       employee: { $in: employeeIds },
//       date: { $gte: startOfToday, $lte: endOfToday },
//     })
//       .populate(
//         "employee",
//         "name email department role employeeId reportingManager"
//       )
//       .sort({ date: -1 });

//     // 5) Map employeeId -> attendance record
//     const attendanceMap = new Map();
//     records.forEach((rec) => {
//       attendanceMap.set(rec.employee._id.toString(), rec);
//     });

//     // 6) Build unified employees array including absents
//     const employeesWithTodayAttendance = employees.map((emp) => {
//       const rec = attendanceMap.get(emp._id.toString());
//       return {
//         _id: emp._id,
//         name: emp.name,
//         email: emp.email,
//         department: emp.department,
//         role: emp.role,
//         employeeId: emp.employeeId,
//         reportingManager: emp.reportingManager,
//         checkInTime: rec ? rec.checkInTime : null,
//         checkOutTime: rec ? rec.checkOutTime : null,
//         date: rec ? rec.date : null,
//       };
//     });

//     return res.status(200).json({ employees: employeesWithTodayAttendance });
//   } catch (err) {
//     console.error("Error fetching manager today's attendance:", err);
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// });

app.get("/attendance/manager/:managerId/today", async (req, res) => {
  try {
    const { managerId } = req.params;

    if (!managerId || !managerId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid manager ID" });
    }

    const employees = await User.find(
      { reportingManager: managerId },
      "_id name email department role employeeId reportingManager",
    );

    if (!employees.length) {
      return res.status(200).json({ employees: [] });
    }

    const employeeIds = employees.map((e) => e._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await Attendance.find({
      employee: { $in: employeeIds },
      date: today,
    });

    const attendanceMap = new Map();
    records.forEach((rec) => {
      attendanceMap.set(rec.employee.toString(), rec);
    });

    const employeesWithTodayAttendance = employees.map((emp) => {
      const rec = attendanceMap.get(emp._id.toString());
      return {
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        role: emp.role,
        employeeId: emp.employeeId,
        reportingManager: emp.reportingManager,

        checkInTime: rec ? rec.checkIn : null,
        checkOutTime: rec ? rec.checkOut : null,
        date: rec ? rec.date : null,
      };
    });

    res.status(200).json({ employees: employeesWithTodayAttendance });
  } catch (err) {
    console.error("Error fetching manager today's attendance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
