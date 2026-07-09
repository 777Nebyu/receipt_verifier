import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Activity,
  Camera,
  Download,
  Eye,
  EyeOff,
  FileSearch,
  History,
  Lock,
  LogOut,
  PieChart,
  ReceiptText,
  Save,
  Shield,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const providers = [
  { code: "telebirr", name: "Telebirr", hint: "DG or CHQ reference" },
  { code: "cbe", name: "CBE ", hint: "FT reference + last 8 account digits" },
  { code: "boa", name: "Bank of Abyssinia", hint: "FT reference + last 5 account digits" },
];

function money(value) {
  if (value === undefined || value === null || value === "") return "Not found";
  return `${Number(value).toLocaleString()} ETB`;
}

function providerNeedsSuffix(provider) {
  return provider === "cbe" || provider === "boa";
}

async function downloadReceiptPdf(result, token) {
  const receiptId = result.receiptId;
  if (!receiptId) throw new Error("Receipt PDF is not available for this verification.");

  const response = await fetch(`${API_URL}/receipt/${receiptId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    throw new Error(data.message || "Could not download receipt PDF.");
  }

  const blob = await response.blob();
  const fileUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const reference = String(result.reference || receiptId).replace(/[^a-z0-9_-]/gi, "_");
  link.href = fileUrl;
  link.download = `receipt-${reference}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(fileUrl);
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [resetForm, setResetForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [merchantForm, setMerchantForm] = useState({ fullName: "", email: "", password: "" });
  const [profileForm, setProfileForm] = useState({ fullName: "", password: "" });
  const [adminEditForms, setAdminEditForms] = useState({});
  const [verifyForm, setVerifyForm] = useState({ provider: "telebirr", reference: "", accountNumber: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [admin, setAdmin] = useState({ users: [], logs: [], stats: null });
  const [activePage, setActivePage] = useState("verify");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [showMerchantPassword, setShowMerchantPassword] = useState(false);
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? authHeaders : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.message || "Request failed.");
    return data;
  }, [authHeaders, token]);

  async function submitAuth(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify(authForm) });
      setToken(data.token);
      setUser(data.user);
      setProfileForm({ fullName: data.user.full_name || data.user.fullName || "", password: "" });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitResetPassword(event) {
    event.preventDefault();
    setMessage("");
    if (resetForm.password !== resetForm.confirmPassword) {
      setMessage("New password and confirm password must match.");
      return;
    }

    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: resetForm.email, password: resetForm.password }),
      });
      setAuthForm({ email: resetForm.email, password: "" });
      setResetForm({ email: "", password: "", confirmPassword: "" });
      setAuthMode("login");
      setMessage("Password changed. Login with your new password.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const loadHistory = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api("/receipt/history");
      setHistory(data.history || []);
    } catch (error) {
      setMessage(error.message);
    }
  }, [api, token]);

  const loadAdmin = useCallback(async () => {
    if (!token || user?.role !== "admin") return;
    try {
      const [usersData, logsData, statsData] = await Promise.all([
        api("/admin/users"),
        api("/admin/logs"),
        api("/admin/stats"),
      ]);
      setAdmin({ users: usersData.users || [], logs: logsData.logs || [], stats: statsData.stats });
    } catch (error) {
      setMessage(error.message);
    }
  }, [api, token, user?.role]);

  useEffect(() => {
    loadHistory();
    loadAdmin();
  }, [loadAdmin, loadHistory]);

  useEffect(() => {
    if (user?.role !== "admin" && activePage === "users") setActivePage("verify");
  }, [activePage, user]);

  useEffect(() => {
    if (user) setProfileForm((current) => ({ ...current, fullName: user.full_name || user.fullName || "" }));
  }, [user]);

  useEffect(() => {
    const forms = {};
    admin.users.forEach((item) => {
      forms[item.id] = {
        fullName: item.full_name || "",
        email: item.email || "",
        password: "",
        role: item.role || "merchant",
      };
    });
    setAdminEditForms(forms);
  }, [admin.users]);

  async function submitVerify(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const data = await api("/receipt/verify", { method: "POST", body: JSON.stringify(verifyForm) });
      setResult(data.result);
      await loadHistory();
      await loadAdmin();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitUpload(event) {
    event.preventDefault();
    if (!uploadFile) {
      setMessage("Choose a receipt image first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("receipt", uploadFile);
      body.append("provider", verifyForm.provider);
      body.append("accountNumber", verifyForm.accountNumber);
      const data = await api("/receipt/upload", { method: "POST", body });
      const detectedProvider = data.ocr?.provider;
      const detectedReference = data.ocr?.reference;
      if (detectedProvider || detectedReference) {
        setVerifyForm((current) => ({
          ...current,
          provider: detectedProvider || current.provider,
          reference: detectedReference || current.reference,
        }));
      }
      if (providerNeedsSuffix(detectedProvider) && detectedReference && !verifyForm.accountNumber) {
        setResult({
          verified: false,
          provider: detectedProvider,
          reference: detectedReference,
          reason: "Enter the receiver account suffix, then press Verify receipt.",
        });
        setMessage(`${detectedProvider.toUpperCase()} reference found. Enter the receiver account suffix to verify.`);
      } else {
        setResult(data.result || { verified: false, rawText: data.ocr?.text, reference: detectedReference });
      }
      await loadHistory();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function createMerchant(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      await api("/admin/users", { method: "POST", body: JSON.stringify(merchantForm) });
      setMerchantForm({ fullName: "", email: "", password: "" });
      setMessage("Seller account created.");
      await loadAdmin();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const payload = { fullName: profileForm.fullName };
      if (profileForm.password) payload.password = profileForm.password;
      const data = await api("/auth/me", { method: "PUT", body: JSON.stringify(payload) });
      setUser(data.user);
      setProfileForm({ fullName: data.user.full_name || "", password: "" });
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.token) {
        setToken(data.token);
        localStorage.setItem("token", data.token);
      }
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateAdminUser(id) {
    setLoading(true);
    setMessage("");
    try {
      const form = adminEditForms[id];
      const payload = {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      await api(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      setMessage("User updated.");
      await loadAdmin();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deactivateAdminUser(id) {
    setLoading(true);
    setMessage("");
    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      setMessage("User removed from active list.");
      await loadAdmin();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setResult(null);
    setHistory([]);
  }

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="brand-mark">
            <ReceiptText size={32} />
          </div>
          <h1>Receipt Verification System</h1>
          {authMode === "login" ? (
            <>
              <p className="muted">Sign in with the account created by your admin.</p>
              <form onSubmit={submitAuth} className="form-stack">
                <label>
                  Email
                  <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} />
                </label>
                <label>
                  <span className="field-heading">
                    Password
                    <button
                      type="button"
                      className="inline-text-button"
                      onClick={() => {
                        setMessage("");
                        setResetForm({ email: authForm.email, password: "", confirmPassword: "" });
                        setAuthMode("reset");
                      }}
                    >
                      Forgot password?
                    </button>
                  </span>
                  <span className="password-field">
                    <input type={showLoginPassword ? "text" : "password"} value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showLoginPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                    >
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {message && <DismissibleAlert message={message} onClose={() => setMessage("")} />}
                <button type="submit" disabled={loading}>
                  <Lock size={18} />
                  {loading ? "Please wait" : "Login"}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="muted">Enter your email and choose a new password.</p>
              <form onSubmit={submitResetPassword} className="form-stack">
                <label>
                  Email
                  <input type="email" value={resetForm.email} onChange={(e) => setResetForm({ ...resetForm, email: e.target.value })} />
                </label>
                <label>
                  New password
                  <span className="password-field">
                    <input type={showResetPassword ? "text" : "password"} value={resetForm.password} onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })} />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showResetPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowResetPassword(!showResetPassword)}
                    >
                      {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <label>
                  Confirm password
                  <span className="password-field">
                    <input
                      type={showResetConfirmPassword ? "text" : "password"}
                      value={resetForm.confirmPassword}
                      onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showResetConfirmPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    >
                      {showResetConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {message && <DismissibleAlert message={message} onClose={() => setMessage("")} />}
                <button type="submit" disabled={loading}>
                  <Save size={18} />
                  {loading ? "Saving" : "Change password"}
                </button>
              </form>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMessage("");
                  setAuthMode("login");
                }}
              >
                Back to login
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <ReceiptText />
          <span>ReceiptGuard</span>
        </div>
        <nav>
          <button type="button" className={activePage === "verify" ? "active" : ""} onClick={() => setActivePage("verify")}>
            <FileSearch size={18} /> Verify and Upload
          </button>
          <button type="button" className={activePage === "history" ? "active" : ""} onClick={() => setActivePage("history")}>
            <History size={18} /> History and Stats
          </button>
          <button type="button" className={activePage === "profile" ? "active" : ""} onClick={() => setActivePage("profile")}>
            <Users size={18} /> Profile
          </button>
          {user?.role === "admin" && (
            <button type="button" className={activePage === "users" ? "active" : ""} onClick={() => setActivePage("users")}>
              <Shield size={18} /> User Control
            </button>
          )}
        </nav>
        <button type="button" onClick={logout} className="logout">
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            
            <h1>
              {activePage === "verify"
                ? "Payment receipt verification"
                : activePage === "history"
                  ? "History and statistics"
                  : activePage === "profile"
                    ? "User profile"
                    : "User control"}
            </h1>
          </div>
          <div className="user-pill">
            <span>{user?.full_name || user?.fullName || user?.email}</span>
            <strong>{user?.role}</strong>
          </div>
        </header>

        {message && <DismissibleAlert message={message} onClose={() => setMessage("")} wide />}

        {activePage === "verify" && (
          <>
            <section className="grid two">
              <div className="panel">
                <div className="panel-title">
                  <FileSearch />
                  <div>
                    <h2>Verify by reference or link</h2>
                   
                  </div>
                </div>
                <form onSubmit={submitVerify} className="form-stack">
                  <label>
                    Provider
                    <select value={verifyForm.provider} onChange={(e) => setVerifyForm({ ...verifyForm, provider: e.target.value })}>
                      {providers.map((provider) => (
                        <option key={provider.code} value={provider.code}>{provider.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reference or receipt URL
                    <input value={verifyForm.reference} onChange={(e) => setVerifyForm({ ...verifyForm, reference: e.target.value })} placeholder="DG..., CHQ..., FT..., or full URL" />
                  </label>
                  <label>
                    Receiver account number or suffix
                    <input value={verifyForm.accountNumber} onChange={(e) => setVerifyForm({ ...verifyForm, accountNumber: e.target.value })} placeholder="Required for CBE and BOA" />
                  </label>
                  <div className="actions">
                    <button type="submit" disabled={loading}>
                      <Activity size={18} />
                      {loading ? "Verifying" : "Verify receipt"}
                    </button>
                    <button type="button" className="secondary" onClick={() => setScannerOpen(!scannerOpen)}>
                      <Camera size={18} />
                      QR scan
                    </button>
                  </div>
                </form>
                <div className="hint-list">
                  {providers.map((provider) => <span key={provider.code}>{provider.hint}</span>)}
                </div>
              </div>

              <ResultPanel result={result} token={token} />
            </section>

            {scannerOpen && <QrPanel setScannerOpen={setScannerOpen} setResult={setResult} api={api} loadHistory={loadHistory} />}

            <section className="panel">
              <div className="panel-title">
                <Upload />
                <div>
                  <h2>Receipt screenshot OCR</h2>
                  <p>Upload a receipt screenshot.</p>
                </div>
              </div>
              <form onSubmit={submitUpload} className="upload-row">
                <input type="file" accept="image/*" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                <button type="submit" disabled={loading}>
                  <Upload size={18} />
                  Upload and verify
                </button>
              </form>
            </section>
          </>
        )}

        {activePage === "history" && (
          <section className={user?.role === "admin" ? "grid two" : "grid"}>
            <div className="panel">
              <div className="panel-title">
                <History />
                <div>
                  <h2>Verification history</h2>
                  <p>{user?.role === "admin" ? "All merchant verification records." : "Your verification records."}</p>
                </div>
              </div>
              <HistoryTable history={history} showUser={user?.role === "admin"} />
            </div>
            {user?.role === "admin" && <StatsPanel admin={admin} user={user} />}
          </section>
        )}

        {activePage === "profile" && (
          <ProfilePanel
            user={user}
            profileForm={profileForm}
            setProfileForm={setProfileForm}
            updateProfile={updateProfile}
            loading={loading}
            showProfilePassword={showProfilePassword}
            setShowProfilePassword={setShowProfilePassword}
          />
        )}

        {activePage === "users" && (
          <UserControlPanel
            admin={admin}
            currentUserId={user?.id}
            merchantForm={merchantForm}
            setMerchantForm={setMerchantForm}
            adminEditForms={adminEditForms}
            setAdminEditForms={setAdminEditForms}
            createMerchant={createMerchant}
            updateAdminUser={updateAdminUser}
            deactivateAdminUser={deactivateAdminUser}
            loading={loading}
            showMerchantPassword={showMerchantPassword}
            setShowMerchantPassword={setShowMerchantPassword}
          />
        )}
      </section>
    </main>
  );
}

function DismissibleAlert({ message, onClose, wide = false }) {
  return (
    <div className={`alert ${wide ? "wide" : ""}`} role="status">
      <span>{message}</span>
      <button type="button" className="alert-close" aria-label="Close notification" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}

function ResultPanel({ result, token }) {
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState(false);

  if (!result) {
    return (
      <div className="panel result-empty">
        <ReceiptText size={44} />
        <h2>No verification yet</h2>
      </div>
    );
  }

  return (
    <div className={`panel result ${result.verified ? "success" : "failed"}`}>
      <div className="status-line">
        <span>{result.verified ? "Verified" : "Not verified"}</span>
        <strong>{result.providerName || result.provider}</strong>
      </div>
      <dl className="details">
        <div><dt>Reference</dt><dd>{result.reference || "Not found"}</dd></div>
        <div><dt>Amount</dt><dd>{money(result.amount)}</dd></div>
        <div><dt>Sender</dt><dd>{result.senderName || "Not found"}</dd></div>
        <div><dt>Receiver</dt><dd>{result.receiverName || result.bankAccountName || "Not found"}</dd></div>
        <div><dt>Sender account</dt><dd>{result.senderAccount || "Not found"}</dd></div>
        <div><dt>Receiver account</dt><dd>{result.receiverAccount || result.bankAccountNumber || "Not found"}</dd></div>
        <div><dt>Date</dt><dd>{result.date || "Not found"}</dd></div>
        <div><dt>Status</dt><dd>{result.transactionStatus || result.reason || "Completed"}</dd></div>
      </dl>
      {downloadError && <p className="muted">{downloadError}</p>}
      {result.verified && result.receiptId && (
        <button
          type="button"
          className="download"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            setDownloadError("");
            try {
              await downloadReceiptPdf(result, token);
            } catch (error) {
              setDownloadError(error.message);
            } finally {
              setDownloading(false);
            }
          }}
        >
          <Download size={18} />
          {downloading ? "Preparing PDF" : "Download PDF receipt"}
        </button>
      )}
    </div>
  );
}

function QrPanel({ setScannerOpen, setResult, api, loadHistory }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 240 }, false);
    scannerRef.current.render(
      async (decodedText) => {
        try {
          await scannerRef.current.clear();
          setScannerOpen(false);
          const data = await api("/receipt/verify", { method: "POST", body: JSON.stringify({ qrData: decodedText, provider: "boa" }) });
          setResult(data.result);
          await loadHistory();
        } catch (error) {
          setResult({ verified: false, reason: error.message });
        }
      },
      () => {}
    );
    return () => {
      scannerRef.current?.clear().catch(() => {});
    };
  }, [api, loadHistory, setResult, setScannerOpen]);

  return (
    <section className="panel scanner">
      <div className="panel-title">
        <Camera />
        <div>
          <h2>QR verification</h2>
          <p>BOA encrypted QR payloads are decrypted on the Express backend.</p>
        </div>
      </div>
      <div id="qr-reader" />
    </section>
  );
}

function HistoryTable({ history, showUser = false }) {
  if (!history.length) return <p className="muted">No receipt verification history yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showUser && <th>Verified by</th>}
            <th>Provider</th>
            <th>Reference</th>
            <th>Amount</th>
            <th>Result</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item) => (
            <tr key={item.id}>
              {showUser && <td>{item.user_name || "Unknown"}</td>}
              <td>{item.provider}</td>
              <td>{item.reference_code}</td>
              <td>{money(item.amount)}</td>
              <td><span className={item.is_verified ? "badge ok" : "badge bad"}>{item.is_verified ? "Verified" : "Failed"}</span></td>
              <td>{new Date(item.upload_time).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProfilePanel({
  user,
  profileForm,
  setProfileForm,
  updateProfile,
  loading,
  showProfilePassword,
  setShowProfilePassword,
}) {
  return (
    <section className="panel profile-panel">
      <div className="panel-title">
        <Users />
        <div>
          <h2>Profile</h2>
          <p>Update your display name and password.</p>
        </div>
      </div>
      <form onSubmit={updateProfile} className="form-stack">
        <label>
          Full name
          <input value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} />
        </label>
        <label>
          Email
          <input value={user?.email || ""} disabled />
        </label>
        <label>
          New password
          <span className="password-field">
            <input
              type={showProfilePassword ? "text" : "password"}
              value={profileForm.password}
              onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
              placeholder="Leave blank to keep current password"
            />
            <button
              type="button"
              className="icon-button"
              aria-label={showProfilePassword ? "Hide password" : "Show password"}
              onClick={() => setShowProfilePassword(!showProfilePassword)}
            >
              {showProfilePassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button type="submit" disabled={loading}>
          <Save size={18} />
          Save profile
        </button>
      </form>
    </section>
  );
}

function StatsPanel({ admin, user }) {
  const chartData = admin.stats?.byProvider || [];
  if (user?.role !== "admin") {
    return (
      <div className="panel result-empty">
        <PieChart size={44} />
        <h2>Statistics</h2>
        <p>Statistics are available for admin users.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">
        <PieChart />
        <div>
          <h2>Verification statistics</h2>
          <p>Total: {admin.stats?.total || 0} | Verified: {admin.stats?.verified || 0} | Failed: {admin.stats?.failed || 0}</p>
        </div>
      </div>
      <div className="chart">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#136f63" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function UserControlPanel({
  admin,
  currentUserId,
  merchantForm,
  setMerchantForm,
  adminEditForms,
  setAdminEditForms,
  createMerchant,
  updateAdminUser,
  deactivateAdminUser,
  loading,
  showMerchantPassword,
  setShowMerchantPassword,
}) {
  return (
    <>
      <section className="panel">
        <div className="panel-title">
          <Users />
          <div>
            <h2>Create seller account</h2>
            <p>Sellers can log in and verify receipts.</p>
          </div>
        </div>
        <form onSubmit={createMerchant} className="form-stack user-form">
          <label>
            Full name
            <input value={merchantForm.fullName} onChange={(e) => setMerchantForm({ ...merchantForm, fullName: e.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={merchantForm.email} onChange={(e) => setMerchantForm({ ...merchantForm, email: e.target.value })} />
          </label>
          <label>
            Password
            <span className="password-field">
              <input type={showMerchantPassword ? "text" : "password"} value={merchantForm.password} onChange={(e) => setMerchantForm({ ...merchantForm, password: e.target.value })} />
              <button
                type="button"
                className="icon-button"
                aria-label={showMerchantPassword ? "Hide password" : "Show password"}
                onClick={() => setShowMerchantPassword(!showMerchantPassword)}
              >
                {showMerchantPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <button type="submit" disabled={loading}>
            <Users size={18} />
            Create seller
          </button>
        </form>
      </section>
      <section className="grid">
        <div className="panel">
          <div className="panel-title">
            <Users />
            <div>
              <h2>Merchant accounts</h2>
              <p>{admin.users.length} registered users.</p>
            </div>
          </div>
          <div className="user-list">
            {admin.users.length ? admin.users.map((item) => {
              const form = adminEditForms[item.id] || { fullName: "", email: "", password: "", role: "merchant" };
              return (
                <div className="user-edit-row" key={item.id}>
                  <label>
                    Name
                    <input value={form.fullName} onChange={(e) => setAdminEditForms({ ...adminEditForms, [item.id]: { ...form, fullName: e.target.value } })} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={form.email} onChange={(e) => setAdminEditForms({ ...adminEditForms, [item.id]: { ...form, email: e.target.value } })} />
                  </label>
                  <label>
                    New password
                    <input type="password" value={form.password} placeholder="Optional" onChange={(e) => setAdminEditForms({ ...adminEditForms, [item.id]: { ...form, password: e.target.value } })} />
                  </label>
                  <label>
                    Role
                    <select value={form.role} onChange={(e) => setAdminEditForms({ ...adminEditForms, [item.id]: { ...form, role: e.target.value } })}>
                      <option value="merchant">Merchant</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <div className="row-actions">
                    <button type="button" className="secondary" disabled={loading} onClick={() => updateAdminUser(item.id)}>
                      <Save size={18} />
                      Save
                    </button>
                    <button type="button" className="danger" disabled={loading || item.id === currentUserId} onClick={() => deactivateAdminUser(item.id)}>
                      <Trash2 size={18} />
                      Remove
                    </button>
                  </div>
                </div>
              );
            }) : <p className="muted">No users found.</p>}
          </div>
        </div>
      </section>
      <section className="grid">
        <div className="panel">
          <div className="panel-title">
            <Shield />
            <div>
              <h2>Activity logs</h2>
              <p>{admin.logs.length} recent log records.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Action</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {admin.logs.length ? admin.logs.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td>{item.email || item.full_name || item.user_id || "System"}</td>
                    <td>{item.action}</td>
                    <td>{new Date(item.created_at || item.timestamp || item.log_time).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="3">No activity logs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

export default App;
