"use client";
import React, { useState } from "react";
import { Link2, Download, AlertCircle, FileDown } from "lucide-react";

const FormScraperUI = () => {
  const [formLink, setFormLink] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("pdf");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = (base64Data, fileName) => {
    const link = document.createElement("a");
    link.href = `data:application/${fileType};base64,${base64Data}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formLink) {
      setError("Please enter a Google Form link");
      return;
    }
    if (!fileName) {
      setError("Please enter a file name");
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formLink,
          fileName,
          fileType,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to process form");
      }

      handleDownload(data.data, data.fileName);
    } catch (error) {
      setError(error.message || "An error occurred while processing the form");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="text-black min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header Section */}
        <div className="mb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 p-3 rounded-lg">
              <FileDown size={24} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            Google Form Scraper
          </h1>
          <p className="text-gray-600 mt-2">
            Extract form data into PDF or DOCX format
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 backdrop-blur-sm bg-opacity-90">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form Link Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Google Form Link
              </label>
              <div className="relative group">
                <div className="absolute left-3 top-3 text-gray-400 group-hover:text-indigo-600 transition-colors">
                  <Link2 size={16} />
                </div>
                <input
                  type="url"
                  placeholder="https://docs.google.com/forms/..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 hover:bg-white"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                />
              </div>
            </div>

            {/* File Name Input */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                File Name
              </label>
              <input
                type="text"
                placeholder="Enter file name"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-gray-50 hover:bg-white"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>

            {/* File Type Selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Output Format
              </label>
              <div className="flex space-x-4 bg-gray-50 p-2 rounded-lg">
                <label className="relative flex items-center space-x-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="fileType"
                    value="pdf"
                    checked={fileType === "pdf"}
                    onChange={(e) => setFileType(e.target.value)}
                    className="hidden"
                  />
                  <div
                    className={`w-full py-2 px-4 rounded-lg text-center text-sm font-medium transition-all ${
                      fileType === "pdf"
                        ? "bg-white shadow-sm text-indigo-600"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    PDF
                  </div>
                </label>
                <label className="relative flex items-center space-x-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="fileType"
                    value="docx"
                    checked={fileType === "docx"}
                    onChange={(e) => setFileType(e.target.value)}
                    className="hidden"
                  />
                  <div
                    className={`w-full py-2 px-4 rounded-lg text-center text-sm font-medium transition-all ${
                      fileType === "docx"
                        ? "bg-white shadow-sm text-indigo-600"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    DOCX
                  </div>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg text-white font-medium transition-all ${
                isProcessing
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Download Form Data</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Note: Google Form must be public/accessible without sign-in for
          question scraping
        </div>
      </div>
    </div>
  );
};

export default FormScraperUI;
