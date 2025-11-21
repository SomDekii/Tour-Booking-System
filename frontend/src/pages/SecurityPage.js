import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Copy,
  Download,
  Lock,
  Shield,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import api from "../utils/api";

const SecurityPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);
  const [mfaSetupStep, setMfaSetupStep] = useState(0);
  const [qrCode, setQrCode] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const handleGenerateBackupCodes = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = await api.generateBackupCodes();
      setBackupCodes(data.backupCodes);
      setShowBackupCodes(true);
      setSuccess(
        "Backup codes generated successfully. Save them in a secure location!"
      );
    } catch (err) {
      setError(err.message || "Failed to generate backup codes");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDownloadCodes = () => {
    const text = backupCodes.join("\n");
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(text)
    );
    element.setAttribute("download", `mfa-backup-codes-${Date.now()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleSetupMFA = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api.setupMFA();
      setQrCode(data.qrCode);
      setMfaSetupStep(1);
    } catch (err) {
      setError(err.message || "Failed to setup MFA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMFA = async (e) => {
    e.preventDefault();
    setMfaVerifying(true);
    setError("");

    try {
      await api.verifyMFA(mfaCode);
      setSuccess("MFA enabled successfully!");
      setMfaSetupStep(0);
      setMfaCode("");
      setQrCode("");
    } catch (err) {
      setError(err.message || "Invalid MFA code");
    } finally {
      setMfaVerifying(false);
    }
  };

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Security Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your account security and authentication
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* MFA Setup Card */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Two-Factor Authentication
              </h2>
            </div>
            <p className="text-gray-600">
              Add an extra layer of security to your account
            </p>
          </div>

          <div className="p-6">
            {mfaSetupStep === 0 ? (
              <>
                <p className="text-gray-600 mb-6">
                  {user.mfaEnabled
                    ? "Two-factor authentication is enabled on your account."
                    : "Enable two-factor authentication to protect your account with an additional security code."}
                </p>

                {!user.mfaEnabled && (
                  <button
                    onClick={handleSetupMFA}
                    disabled={loading}
                    className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                  >
                    {loading
                      ? "Setting up..."
                      : "Enable Two-Factor Authentication"}
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-gray-600 mb-4">
                    Scan this QR code with your authenticator app (Google
                    Authenticator, Authy, Microsoft Authenticator, etc.)
                  </p>
                  {qrCode && (
                    <div className="flex justify-center mb-6">
                      <img
                        src={qrCode || "/placeholder.svg"}
                        alt="MFA QR Code"
                        className="border border-gray-300 rounded-lg"
                      />
                    </div>
                  )}
                </div>

                <form onSubmit={handleVerifyMFA} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enter 6-digit code
                    </label>
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      maxLength="6"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder="000000"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={mfaVerifying || mfaCode.length !== 6}
                      className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                    >
                      {mfaVerifying ? "Verifying..." : "Verify & Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMfaSetupStep(0)}
                      className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Backup Codes Card */}
        {user.mfaEnabled && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Lock className="w-6 h-6 text-orange-600" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Backup Codes
                </h2>
              </div>
              <p className="text-gray-600">
                Use backup codes if you lose access to your authenticator app
              </p>
            </div>

            <div className="p-6">
              {!showBackupCodes ? (
                <div>
                  <p className="text-gray-600 mb-6">
                    Generate backup codes to access your account if your
                    authenticator app is unavailable. Keep these codes secure
                    and private.
                  </p>
                  <button
                    onClick={handleGenerateBackupCodes}
                    disabled={loading}
                    className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:bg-gray-400"
                  >
                    {loading ? "Generating..." : "Generate Backup Codes"}
                  </button>
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-3">
                      {backupCodes.map((code) => (
                        <div
                          key={code}
                          className="bg-white border border-gray-200 rounded px-3 py-2 flex items-center justify-between group hover:border-orange-300 transition-colors"
                        >
                          <code className="font-mono text-sm text-gray-900">
                            {code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(code)}
                            className="text-gray-400 hover:text-orange-600 transition-colors ml-2"
                            title="Copy code"
                          >
                            <Copy
                              className={`w-4 h-4 transition-all ${
                                copiedCode === code ? "text-green-600" : ""
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-700">
                        Store these codes in a secure location. Each code can
                        only be used once. If compromised, generate new codes
                        immediately.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDownloadCodes}
                    className="flex items-center gap-2 bg-gray-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Codes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityPage;
