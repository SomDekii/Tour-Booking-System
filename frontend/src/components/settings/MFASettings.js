import React from "react";
import { Shield } from "lucide-react";

const MFASettings = ({ user }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-orange-500" />
        <h2 className="text-2xl font-bold text-gray-900">
          Two-Factor Authentication
        </h2>
      </div>

      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          This application uses a per-login one-time code (OTP) sent to your
          registered email address for two-factor authentication. There is no
          need to set up an authenticator app — a code will be emailed to you
          each time you sign in.
        </p>
      </div>

      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-sm text-green-800 font-medium">Status</p>
        <p className="text-sm text-gray-700 mt-2">
          {user?.email
            ? `OTP will be sent to: ${user.email}`
            : "No user detected. Sign in to receive OTPs on login."}
        </p>
      </div>
    </div>
  );
};

export default MFASettings;
