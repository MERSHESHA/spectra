import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearExamSession } from "../services/examService";

const departments = [
  "CSE",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
  "AIDS",
  "AIML",
];

const years = ["1", "2", "3", "4"];

export default function LandingPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    registerNumber: "",
    name: "",
    department: "",
    year: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Register number: allow only numbers and max 12 digits
    if (name === "registerNumber") {
      if (!/^\d*$/.test(value)) return;
      if (value.length > 12) return;
    }

    // Name: allow letters and spaces only
    if (name === "name") {
      if (!/^[a-zA-Z\s]*$/.test(value)) return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts correcting
    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!/^\d{12}$/.test(formData.registerNumber)) {
      newErrors.registerNumber =
        "Register number must contain exactly 12 digits.";
    }

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your name.";
    } else if (!/^[a-zA-Z\s]+$/.test(formData.name.trim())) {
      newErrors.name = "Name must contain letters and spaces only.";
    }

    if (!formData.department) {
      newErrors.department = "Please select your department.";
    }

    if (!formData.year) {
      newErrors.year = "Please select your year.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const participant = {
      registerNumber: formData.registerNumber,
      name: formData.name.trim(),
      department: formData.department,
      year: formData.year,
    };

    // Store participant details for the current exam session
    sessionStorage.setItem(
      "codingParticipant",
      JSON.stringify(participant)
    );

    // Clear any previous exam session so a new registration starts fresh
    clearExamSession();
    sessionStorage.removeItem("examSession");

    navigate("/coding");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/2 -right-40 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between border-b border-white/10 px-6 py-5 md:px-12">
        <div>
          <h1 className="text-xl font-bold tracking-wide">
            CODE<span className="text-cyan-400">X</span>
          </h1>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-gray-400">
          Coding Challenge 2026
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 flex min-h-[calc(100vh-77px)] items-center justify-center px-5 py-10">
        <div className="grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
          
          {/* Left Section */}
          <section className="text-center lg:text-left">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-sm text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              Ready to Code?
            </div>

            <h2 className="text-5xl font-black leading-tight tracking-tight md:text-6xl">
              THINK.
              <br />
              CODE.
              <br />
              <span className="text-cyan-400">COMPETE.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-gray-400 lg:mx-0">
              Welcome to the coding challenge. Enter your student details
              to begin the challenge and prove your problem-solving skills.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-gray-500">Challenge</p>
                <p className="mt-1 font-semibold">Coding</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-gray-500">Mode</p>
                <p className="mt-1 font-semibold">Online</p>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-gray-500">Access</p>
                <p className="mt-1 font-semibold">Individual</p>
              </div>
            </div>
          </section>

          {/* Registration Card */}
          <section className="w-full max-w-md justify-self-center lg:justify-self-end">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl md:p-8">
              <div className="mb-7">
                <h3 className="text-2xl font-bold">
                  Participant Details
                </h3>

                <p className="mt-2 text-sm text-gray-500">
                  Enter your details to start the challenge.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Register Number */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Register Number
                  </label>

                  <input
                    type="text"
                    name="registerNumber"
                    value={formData.registerNumber}
                    onChange={handleChange}
                    placeholder="Enter 12 digit register number"
                    inputMode="numeric"
                    maxLength={12}
                    className={`w-full rounded-xl border bg-black/30 px-4 py-3.5 text-sm outline-none transition placeholder:text-gray-600 focus:border-cyan-400 ${
                      errors.registerNumber
                        ? "border-red-500"
                        : "border-white/10"
                    }`}
                  />

                  {errors.registerNumber && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.registerNumber}
                    </p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Name
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className={`w-full rounded-xl border bg-black/30 px-4 py-3.5 text-sm outline-none transition placeholder:text-gray-600 focus:border-cyan-400 ${
                      errors.name
                        ? "border-red-500"
                        : "border-white/10"
                    }`}
                  />

                  {errors.name && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Department */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Department
                  </label>

                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className={`w-full appearance-none rounded-xl border bg-black/30 px-4 py-3.5 text-sm outline-none transition focus:border-cyan-400 ${
                      formData.department
                        ? "text-white"
                        : "text-gray-600"
                    } ${
                      errors.department
                        ? "border-red-500"
                        : "border-white/10"
                    }`}
                  >
                    <option value="" disabled>
                      Select department
                    </option>

                    {departments.map((department) => (
                      <option
                        key={department}
                        value={department}
                        className="bg-[#111]"
                      >
                        {department}
                      </option>
                    ))}
                  </select>

                  {errors.department && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.department}
                    </p>
                  )}
                </div>

                {/* Year */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Year
                  </label>

                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    className={`w-full appearance-none rounded-xl border bg-black/30 px-4 py-3.5 text-sm outline-none transition focus:border-cyan-400 ${
                      formData.year
                        ? "text-white"
                        : "text-gray-600"
                    } ${
                      errors.year
                        ? "border-red-500"
                        : "border-white/10"
                    }`}
                  >
                    <option value="" disabled>
                      Select year
                    </option>

                    {years.map((year) => (
                      <option
                        key={year}
                        value={year}
                        className="bg-[#111]"
                      >
                        {year} Year
                      </option>
                    ))}
                  </select>

                  {errors.year && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {errors.year}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-black transition hover:bg-cyan-300 active:scale-[0.98]"
                >
                  Start Coding
                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-gray-600">
                Make sure your details are correct before starting.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
