"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
    Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import {
    Activity,
    Plus,
    AlertTriangle,
    TrendingUp,
    UserRound,
    CalendarClock,
    HeartPulse,
    LayoutGrid,
    FileText,
    History,
    LineChart,
    Stethoscope,
    Apple,
    UserCircle2,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Bell,
    Filter,
    Eye,
    Download,
    X,
} from "lucide-react";
// Mock chart implementation for simplicity

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

type NavItem = {
    id: string;
    label: string;
    group: "MAIN" | "MEDICAL" | "CARE TEAM" | "PERSONAL";
    icon: React.ComponentType<{ className?: string }>;
};

type MedicalReport = {
    id: number;
    name: string;
    type: string;
    date: string;
    doctor: string;
    status: "Normal" | "Review";
    timestamp: string;
};

type PatientReading = {
    id: string;
    value: number;
    type: string;
    createdAt: string;
};

type TrendMetricEntry = {
    id: string;
    createdAt: string;
    weight: number;
    systolic: number;
    diastolic: number;
    hba1c: number;
};

export default function PatientDashboard() {
    const [readings, setReadings] = useState<PatientReading[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [newReading, setNewReading] = useState({ value: "", type: "fasting" });
    const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
    const [activeNav, setActiveNav] = useState("trends");
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarPreferenceMode, setSidebarPreferenceMode] = useState<"auto" | "manual">("auto");
    const [reportSearch, setReportSearch] = useState("");
    const [reportType, setReportType] = useState<"all" | "Lab Results" | "Diabetes" | "Imaging">("all");
    const [reportTime, setReportTime] = useState<"all" | "90d" | "1y">("all");
    const [reports, setReports] = useState<MedicalReport[]>([]);
    const [isLoadingReadings, setIsLoadingReadings] = useState(false);
    const [isLoadingReports, setIsLoadingReports] = useState(false);
    const [pageError, setPageError] = useState("");
    const [isSavingReading, setIsSavingReading] = useState(false);
    const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
    const [patientName, setPatientName] = useState("Patient");
    const [trendWindow, setTrendWindow] = useState<"7d" | "30d" | "90d">("7d");
    const [showTrendExportPicker, setShowTrendExportPicker] = useState(false);
    const [showTrendAddForm, setShowTrendAddForm] = useState(false);
    const [isSavingTrendData, setIsSavingTrendData] = useState(false);
    const [customTrendMetrics, setCustomTrendMetrics] = useState<TrendMetricEntry[]>([]);
    const [trendForm, setTrendForm] = useState({
        dateTime: new Date().toISOString().slice(0, 16),
        glucose: "",
        glucoseType: "fasting",
        weight: "",
        systolic: "",
        diastolic: "",
        hba1c: "",
    });

    const navItems: NavItem[] = useMemo(() => [
        { id: "overview", label: "Overview", group: "MAIN", icon: LayoutGrid },
        { id: "reports", label: "Reports", group: "MEDICAL", icon: FileText },
        { id: "records", label: "Past Records", group: "MEDICAL", icon: History },
        { id: "trends", label: "Health Trends", group: "MEDICAL", icon: LineChart },
        { id: "doctors", label: "Doctors", group: "CARE TEAM", icon: Stethoscope },
        { id: "nutrition", label: "Nutritionist", group: "CARE TEAM", icon: Apple },
        { id: "personal", label: "Personal Data", group: "PERSONAL", icon: UserCircle2 },
    ], []);

    useEffect(() => {
        const savedSidebar = localStorage.getItem("gc_patient_sidebar_collapsed");
        const savedRange = localStorage.getItem("gc_patient_range") as "7d" | "30d" | "all" | null;
        const savedName = localStorage.getItem("gc_user_name");
        const savedTrendMetrics = localStorage.getItem("gc_patient_trend_metrics");

        if (savedSidebar !== null) {
            setIsSidebarCollapsed(savedSidebar === "1");
            setSidebarPreferenceMode("manual");
        }

        if (savedRange === "7d" || savedRange === "30d" || savedRange === "all") {
            setRange(savedRange);
        }

        if (savedName) {
            setPatientName(savedName);
        }

        if (savedTrendMetrics) {
            try {
                const parsed = JSON.parse(savedTrendMetrics);
                if (Array.isArray(parsed)) {
                    setCustomTrendMetrics(parsed);
                }
            } catch {
            }
        }
    }, []);

    useEffect(() => {
        const syncSidebarForViewport = () => {
            if (sidebarPreferenceMode === "manual") {
                return;
            }

            if (window.innerWidth >= 768 && window.innerWidth < 1280) {
                setIsSidebarCollapsed(true);
                return;
            }

            if (window.innerWidth >= 1280) {
                setIsSidebarCollapsed(false);
            }
        };

        syncSidebarForViewport();
        window.addEventListener("resize", syncSidebarForViewport);
        return () => window.removeEventListener("resize", syncSidebarForViewport);
    }, [sidebarPreferenceMode]);

    useEffect(() => {
        localStorage.setItem("gc_patient_range", range);
    }, [range]);

    useEffect(() => {
        localStorage.setItem("gc_patient_trend_metrics", JSON.stringify(customTrendMetrics));
    }, [customTrendMetrics]);

    const handleNavClick = (id: string) => {
        setActiveNav(id);
        setShowAdd(false);
        setShowTrendAddForm(false);
    };

    const handleToggleSidebar = () => {
        setIsSidebarCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem("gc_patient_sidebar_collapsed", next ? "1" : "0");
            return next;
        });
        setSidebarPreferenceMode("manual");
    };

    const fetchReadings = useCallback(async (selectedRange: "7d" | "30d" | "all") => {
        const token = localStorage.getItem("gc_token");
        if (!token) {
            setReadings([]);
            return;
        }

        setIsLoadingReadings(true);
        setPageError("");
        try {
            const apiRange = selectedRange === "all" ? "30d" : selectedRange;
            const res = await fetch(`/api/patient/readings?range=${apiRange}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Failed to load glucose readings");
            }

            const data = await res.json();
            if (data?.patient?.name) {
                setPatientName(String(data.patient.name));
            }
            const incoming = Array.isArray(data.readings)
                ? data.readings.map((item: any) => ({
                    id: String(item.id),
                    value: Number(item.value),
                    type: String(item.type),
                    createdAt: String(item.createdAt),
                }))
                : [];

            setReadings(incoming);
        } catch (error: any) {
            setReadings([]);
            setPageError(error.message || "Unable to load readings");
        } finally {
            setIsLoadingReadings(false);
        }
    }, []);

    const fetchMedicalReports = useCallback(async (selectedRange: "all" | "90d" | "1y") => {
        const token = localStorage.getItem("gc_token");
        if (!token) {
            setReports([]);
            return;
        }

        setIsLoadingReports(true);
        setPageError("");
        try {
            const apiRange = selectedRange === "1y" ? "all" : selectedRange;
            const res = await fetch(`/api/patient/report?format=json&range=${apiRange}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Failed to load medical reports");
            }

            const data = await res.json();

            const readingRows: MedicalReport[] = Array.isArray(data.readings)
                ? data.readings.map((item: any, index: number) => ({
                    id: index + 1,
                    name: `Glucose Reading (${String(item.type || "reading")})`,
                    type: "Diabetes",
                    date: new Date(item.createdAt).toLocaleDateString(),
                    doctor: "Self Logged",
                    status: Number(item.value) > 180 || Number(item.value) < 70 ? "Review" : "Normal",
                    timestamp: String(item.createdAt),
                }))
                : [];

            const alertRows: MedicalReport[] = Array.isArray(data.alerts)
                ? data.alerts.map((item: any, index: number) => ({
                    id: 2000 + index,
                    name: String(item.message || "Alert"),
                    type: "Lab Results",
                    date: new Date(item.createdAt).toLocaleDateString(),
                    doctor: "Care Team",
                    status: String(item.severity || "").toLowerCase().includes("high") ? "Review" : "Normal",
                    timestamp: String(item.createdAt),
                }))
                : [];

            const reminderRows: MedicalReport[] = Array.isArray(data.reminders)
                ? data.reminders.map((item: any, index: number) => ({
                    id: 4000 + index,
                    name: String(item.title || "Reminder"),
                    type: "Imaging",
                    date: new Date(item.remindAt).toLocaleDateString(),
                    doctor: String(item?.doctor?.name || "Assigned Doctor"),
                    status: item.isDone ? "Normal" : "Review",
                    timestamp: String(item.remindAt),
                }))
                : [];

            const allRows = [...readingRows, ...alertRows, ...reminderRows]
                .filter((row) => {
                    if (selectedRange !== "1y") {
                        return true;
                    }
                    const ageDays = (Date.now() - new Date(row.timestamp).getTime()) / (1000 * 60 * 60 * 24);
                    return ageDays <= 365;
                })
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            setReports(allRows);
        } catch (error: any) {
            setReports([]);
            setPageError(error.message || "Unable to load reports");
        } finally {
            setIsLoadingReports(false);
        }
    }, []);

    useEffect(() => {
        fetchReadings(range);
    }, [fetchReadings, range]);

    useEffect(() => {
        fetchMedicalReports(reportTime);
    }, [fetchMedicalReports, reportTime]);

    const handleAddReading = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsedValue = Number(newReading.value);
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
            return;
        }

        const token = localStorage.getItem("gc_token");
        if (!token) {
            setPageError("No active session. Please log in again.");
            return;
        }

        setIsSavingReading(true);
        setPageError("");
        try {
            const res = await fetch("/api/patient/readings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    value: parsedValue,
                    type: newReading.type,
                    createdAt: new Date().toISOString()
                })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save reading");
            }

            await fetchReadings(range);
            await fetchMedicalReports(reportTime);
            setShowAdd(false);
            setNewReading({ value: "", type: "fasting" });
        } catch (error: any) {
            setPageError(error.message || "Unable to save reading");
        } finally {
            setIsSavingReading(false);
        }
    };

    const handleAddTrendData = async (e: React.FormEvent) => {
        e.preventDefault();

        const glucose = Number(trendForm.glucose);
        const weight = Number(trendForm.weight);
        const systolic = Number(trendForm.systolic);
        const diastolic = Number(trendForm.diastolic);
        const hba1c = Number(trendForm.hba1c);
        const date = new Date(trendForm.dateTime);

        if (!Number.isFinite(glucose) || glucose < 20 || glucose > 600) {
            setPageError("Enter a valid glucose value (20-600).");
            return;
        }

        if (!Number.isFinite(weight) || weight < 20 || weight > 300) {
            setPageError("Enter a valid weight value (20-300 kg).");
            return;
        }

        if (!Number.isFinite(systolic) || systolic < 70 || systolic > 220) {
            setPageError("Enter a valid systolic value (70-220).");
            return;
        }

        if (!Number.isFinite(diastolic) || diastolic < 40 || diastolic > 140) {
            setPageError("Enter a valid diastolic value (40-140).");
            return;
        }

        if (!Number.isFinite(hba1c) || hba1c < 3 || hba1c > 20) {
            setPageError("Enter a valid HbA1c value (3-20).");
            return;
        }

        if (Number.isNaN(date.getTime())) {
            setPageError("Select a valid date and time.");
            return;
        }

        const token = localStorage.getItem("gc_token");
        if (!token) {
            setPageError("No active session. Please log in again.");
            return;
        }

        const isoDate = date.toISOString();
        setIsSavingTrendData(true);
        setPageError("");

        try {
            const res = await fetch("/api/patient/readings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    value: glucose,
                    type: trendForm.glucoseType,
                    createdAt: isoDate,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save trend data");
            }

            setCustomTrendMetrics((prev) => {
                const nextEntry: TrendMetricEntry = {
                    id: `${Date.now()}`,
                    createdAt: isoDate,
                    weight,
                    systolic,
                    diastolic,
                    hba1c,
                };

                const filtered = prev.filter((item) => item.createdAt !== isoDate);
                return [...filtered, nextEntry].sort(
                    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
            });

            await fetchReadings(range);
            await fetchMedicalReports(reportTime);

            setShowTrendAddForm(false);
            setTrendForm({
                dateTime: new Date().toISOString().slice(0, 16),
                glucose: "",
                glucoseType: "fasting",
                weight: "",
                systolic: "",
                diastolic: "",
                hba1c: "",
            });
        } catch (error: any) {
            setPageError(error.message || "Unable to save trend data");
        } finally {
            setIsSavingTrendData(false);
        }
    };

    const handleViewReport = (report: MedicalReport) => {
        setSelectedReport(report);
    };

    const closeReportModal = () => {
        setSelectedReport(null);
    };

    const handleDownloadReport = (report: MedicalReport) => {
        const headers = ["Report Name", "Type", "Date", "Doctor", "Status", "Timestamp"];
        const row = [report.name, report.type, report.date, report.doctor, report.status, report.timestamp]
            .map((value) => {
                const text = String(value ?? "");
                return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
            });

        const csv = `${headers.join(",")}\n${row.join(",")}`;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `medical-report-${report.id}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const latestReading = readings[0]?.value || 0;
    const previousReading = readings[1]?.value || latestReading;
    let statusColor = "text-green-600";
    let statusAlert = "Normal";

    if (latestReading > 140) {
        statusColor = "text-red-600";
        statusAlert = "High Risk";
    } else if (latestReading < 70) {
        statusColor = "text-yellow-600";
        statusAlert = "Low Risk";
    }

    const filteredReadings = useMemo(() => {
        if (range === "all") {
            return readings;
        }

        const now = Date.now();
        const limit = range === "7d" ? 7 : 30;
        return readings.filter((item) => {
            const ageInDays = (now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            return ageInDays <= limit;
        });
    }, [range, readings]);

    const average = Math.round(
        (filteredReadings.reduce((sum, item) => sum + item.value, 0) / (filteredReadings.length || 1))
    );

    const filteredMedicalReports = useMemo(() => {
        const query = reportSearch.trim().toLowerCase();
        const now = Date.now();

        return reports.filter((report) => {
            const matchesQuery = !query
                || report.name.toLowerCase().includes(query)
                || report.doctor.toLowerCase().includes(query)
                || report.type.toLowerCase().includes(query);

            const matchesType = reportType === "all" || report.type === reportType;

            let matchesTime = true;
            if (reportTime !== "all") {
                const dateMs = new Date(report.timestamp).getTime();
                const ageDays = (now - dateMs) / (1000 * 60 * 60 * 24);
                matchesTime = reportTime === "90d" ? ageDays <= 90 : ageDays <= 365;
            }

            return matchesQuery && matchesType && matchesTime;
        });
    }, [reports, reportSearch, reportType, reportTime]);

    const trendDelta = latestReading - previousReading;
    const trendLabel = trendDelta === 0 ? "No change" : trendDelta > 0 ? `+${trendDelta} mg/dL` : `${trendDelta} mg/dL`;
    const trendColor = trendDelta > 0 ? "text-red-600" : trendDelta < 0 ? "text-teal-600" : "text-slate-600";
    const isOverview = activeNav === "overview";
    const activeLabel = navItems.find((item) => item.id === activeNav)?.label || "Overview";
    const showSection = (id: string) => isOverview || activeNav === id;

    const trendReadings = useMemo(() => {
        const now = Date.now();
        const days = trendWindow === "7d" ? 7 : trendWindow === "30d" ? 30 : 90;

        const filtered = readings
            .filter((item) => {
                const ageInDays = (now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                return ageInDays <= days;
            })
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        return filtered;
    }, [readings, trendWindow]);

    const trendPoints = useMemo(() => {
        const base = trendReadings.length > 0 ? trendReadings : readings.slice(0, 6).reverse();
        if (base.length === 0) {
            return [{
                id: "placeholder",
                value: 0,
                type: "fasting",
                createdAt: new Date().toISOString(),
            }];
        }
        return base;
    }, [readings, trendReadings]);

    const trendLabels = useMemo(
        () => trendPoints.map((item) => new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })),
        [trendPoints]
    );

    const trendMetricMap = useMemo(() => {
        const map = new Map<string, TrendMetricEntry>();
        customTrendMetrics.forEach((entry) => {
            map.set(entry.createdAt, entry);
        });
        return map;
    }, [customTrendMetrics]);

    const glucoseSeries = useMemo(() => trendPoints.map((item) => Number(item.value.toFixed(1))), [trendPoints]);
    const weightSeries = useMemo(
        () => trendPoints.map((item, index) => {
            const custom = trendMetricMap.get(item.createdAt);
            if (custom) {
                return Number(custom.weight.toFixed(1));
            }
            return Number((76 - index * 0.5 + (120 - item.value) * 0.02).toFixed(1));
        }),
        [trendMetricMap, trendPoints]
    );
    const systolicSeries = useMemo(
        () => trendPoints.map((item) => {
            const custom = trendMetricMap.get(item.createdAt);
            if (custom) {
                return Math.round(custom.systolic);
            }
            return Math.round(118 + (item.value - 110) * 0.25);
        }),
        [trendMetricMap, trendPoints]
    );
    const diastolicSeries = useMemo(
        () => trendPoints.map((item) => {
            const custom = trendMetricMap.get(item.createdAt);
            if (custom) {
                return Math.round(custom.diastolic);
            }
            return Math.round(76 + (item.value - 110) * 0.1);
        }),
        [trendMetricMap, trendPoints]
    );
    const hba1cSeries = useMemo(
        () => trendPoints.map((item) => {
            const custom = trendMetricMap.get(item.createdAt);
            if (custom) {
                return Number(custom.hba1c.toFixed(1));
            }
            return Number((((item.value + 46.7) / 28.7)).toFixed(1));
        }),
        [trendMetricMap, trendPoints]
    );

    const trendLineOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: "top" as const },
        },
        scales: {
            x: {
                grid: { color: "rgba(148, 163, 184, 0.15)" },
                ticks: { color: "#64748b" },
            },
            y: {
                grid: { color: "rgba(148, 163, 184, 0.15)" },
                ticks: { color: "#64748b" },
            },
        },
    }), []);

    const buildTrendCsv = () => {
        const headers = ["Date", "Glucose", "Weight", "Systolic", "Diastolic", "HbA1c"];
        const rows = trendPoints.map((point, index) => [
            new Date(point.createdAt).toLocaleDateString(),
            glucoseSeries[index],
            weightSeries[index],
            systolicSeries[index],
            diastolicSeries[index],
            hba1cSeries[index],
        ]);

        return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    };

    const handleExportTrendsCsv = () => {
        const csv = buildTrendCsv();

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `health-trends-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setShowTrendExportPicker(false);
    };

    const handleExportTrendsPdf = () => {
        const rowsHtml = trendPoints
            .map((point, index) => `
                <tr>
                    <td>${new Date(point.createdAt).toLocaleDateString()}</td>
                    <td>${glucoseSeries[index]}</td>
                    <td>${weightSeries[index]}</td>
                    <td>${systolicSeries[index]}</td>
                    <td>${diastolicSeries[index]}</td>
                    <td>${hba1cSeries[index]}</td>
                </tr>
            `)
            .join("");

        const popup = window.open("", "_blank", "width=980,height=720");
        if (!popup) {
            return;
        }

        popup.document.write(`
            <html>
                <head>
                    <title>Health Trends Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
                        h1 { margin: 0 0 6px; }
                        p { margin: 0 0 16px; color: #475569; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 13px; }
                        th { background: #f1f5f9; }
                    </style>
                </head>
                <body>
                    <h1>Health Trends Report</h1>
                    <p>Patient: ${patientName} | Generated: ${new Date().toLocaleString()}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Glucose</th>
                                <th>Weight</th>
                                <th>Systolic</th>
                                <th>Diastolic</th>
                                <th>HbA1c</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </body>
            </html>
        `);
        popup.document.close();
        popup.focus();
        popup.print();
        setShowTrendExportPicker(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 md:flex">
            <aside className={`hidden md:flex bg-slate-950 text-slate-200 border-r border-slate-800 flex-col transition-all duration-300 ${isSidebarCollapsed ? "md:w-20" : "md:w-72 xl:w-80"}`}>
                <div className="px-4 py-6 border-b border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                        <h1 className={`font-bold flex items-center text-teal-400 ${isSidebarCollapsed ? "text-base justify-center w-full" : "gap-2 text-xl"}`}>
                            <Activity className="h-5 w-5" />
                            {!isSidebarCollapsed && "GlucoCare+"}
                        </h1>
                        <button
                            onClick={handleToggleSidebar}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
                            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            {isSidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                        </button>
                    </div>
                    {!isSidebarCollapsed && <p className="text-xs text-slate-400 mt-2">Patient Dashboard</p>}
                </div>
                <nav className="px-3 py-6 space-y-6">
                    {(["MAIN", "MEDICAL", "CARE TEAM", "PERSONAL"] as const).map((group) => (
                        <div key={group} className="space-y-2">
                            {!isSidebarCollapsed && <p className="px-3 text-xs tracking-[0.18em] font-semibold text-slate-500">{group}</p>}
                            <div className="space-y-1">
                                {navItems
                                    .filter((item) => item.group === group)
                                    .map((item) => {
                                        const Icon = item.icon;
                                        const isActive = activeNav === item.id;
                                        return (
                                            <button
                                                key={item.id}
                                                onClick={() => handleNavClick(item.id)}
                                                title={item.label}
                                                aria-current={isActive ? "page" : undefined}
                                                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition ${
                                                    isActive
                                                        ? "bg-teal-500/15 text-teal-300 border-l-2 border-teal-400"
                                                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                                                } ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}
                                            >
                                                <Icon className="h-4 w-4" />
                                                {!isSidebarCollapsed && <span className="font-medium">{item.label}</span>}
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="bg-white px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-teal-600"><Activity className="h-5 w-5" /> GlucoCare+</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-xs sm:text-sm font-medium text-slate-700">{patientName}</p>
                            <p className="text-[11px] sm:text-xs text-slate-500">Patient</p>
                        </div>
                        <div className="h-8 w-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600"><UserRound className="h-5 w-5" /></div>
                    </div>
                </header>

                <div className="md:hidden bg-slate-950 border-b border-slate-800">
                    <div className="overflow-x-auto px-3 py-3">
                        <div className="flex items-center gap-2 min-w-max">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = activeNav === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleNavClick(item.id)}
                                        aria-current={isActive ? "page" : undefined}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                                            isActive
                                                ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                                                : "bg-slate-900 text-slate-300 border border-slate-700"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 text-black">
                <div key={activeNav} className="space-y-6 animate-section-fade">
                {pageError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {pageError}
                    </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h2 id="overview" className="scroll-mt-24 text-2xl font-bold text-slate-900">{isOverview ? "Health Overview" : activeLabel}</h2>
                    {isOverview && <div className="flex items-center gap-2">
                        {(["7d", "30d", "all"] as const).map((option) => (
                            <button
                                key={option}
                                onClick={() => setRange(option)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                                    range === option
                                        ? "bg-teal-600 text-white border-teal-600"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                            >
                                {option === "all" ? "All" : option.toUpperCase()}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowAdd(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition"
                        >
                            <Plus className="h-4 w-4" /> Add Reading
                        </button>
                    </div>}
                </div>

                {isOverview && <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-500 font-medium">Latest Reading</div>
                        <div className="text-3xl font-bold mt-2 flex items-baseline gap-2">
                            {latestReading} <span className="text-sm font-normal text-slate-400">mg/dL</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-500 font-medium">Average ({range === "all" ? "all" : range})</div>
                        <div className="text-3xl font-bold mt-2 flex items-baseline gap-2">
                            {average} <span className="text-sm font-normal text-slate-400">mg/dL</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-500 font-medium">Alert Status</div>
                        <div className={`text-2xl font-bold mt-2 flex items-center gap-2 ${statusColor}`}>
                            {statusAlert === "High Risk" && <AlertTriangle className="h-6 w-6" />}
                            {statusAlert}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="text-sm text-slate-500 font-medium">Trend vs Previous</div>
                        <div className={`text-2xl font-bold mt-2 flex items-center gap-2 ${trendColor}`}>
                            <TrendingUp className="h-5 w-5" />
                            <span>{trendLabel}</span>
                        </div>
                    </div>
                </div>}

                {showAdd && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold mb-4">Add New Reading</h3>
                        <form onSubmit={handleAddReading} className="flex flex-col md:flex-row gap-4 md:items-end">
                            <div className="flex-1">
                                <label className="block text-sm text-slate-600 mb-1">Blood Sugar (mg/dL)</label>
                                <input type="number" min={1} max={600} required className="w-full px-3 py-2 border border-slate-300 rounded-md" value={newReading.value} onChange={(e) => setNewReading({ ...newReading, value: e.target.value })} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm text-slate-600 mb-1">Type</label>
                                <select className="w-full px-3 py-2 border border-slate-300 rounded-md" value={newReading.type} onChange={(e) => setNewReading({ ...newReading, type: e.target.value })}>
                                    <option value="fasting">Fasting</option>
                                    <option value="post-meal">Post-Meal</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium hover:bg-slate-50">Cancel</button>
                                <button type="submit" disabled={isSavingReading} className="px-6 py-2 bg-teal-600 text-white rounded-md font-medium hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed">{isSavingReading ? "Saving..." : "Add"}</button>
                            </div>
                        </form>
                    </div>
                )}

                {(showSection("records") || showSection("trends") || showSection("doctors")) && (
                    <div className={`grid grid-cols-1 gap-6 ${isOverview ? "lg:grid-cols-3" : ""}`}>
                    {showSection("records") && <div id="records" className={`scroll-mt-24 bg-white p-6 rounded-xl shadow-sm border border-slate-200 ${isOverview ? "lg:col-span-2" : ""}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-900">Recent History</h3>
                            <TrendingUp className="text-slate-400" />
                        </div>
                        <div className="space-y-4">
                            {isLoadingReadings && <p className="text-sm text-slate-500">Loading readings...</p>}
                            {filteredReadings.map((r) => (
                                <div key={r.id} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                                    <div>
                                        <div className="font-semibold text-lg">{r.value} mg/dL</div>
                                        <div className="text-sm text-slate-500 capitalize">{r.type} • {new Date(r.createdAt).toLocaleString()}</div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-medium border ${r.value > 140 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                                        {r.value > 140 ? 'High' : 'Normal'}
                                    </div>
                                </div>
                            ))}
                            {filteredReadings.length === 0 && (
                                <p className="text-sm text-slate-500">No readings available for this range.</p>
                            )}
                        </div>
                    </div>}

                    {(showSection("trends") || showSection("doctors")) && <div className="space-y-6">
                        {showSection("trends") && <div id="trends" className="scroll-mt-24 space-y-5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="flex items-center gap-2 text-slate-900">
                                    <LineChart className="h-5 w-5 text-teal-600" />
                                    <h3 className="text-3xl font-bold">Health Trends</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={trendWindow}
                                        onChange={(e) => setTrendWindow(e.target.value as "7d" | "30d" | "90d")}
                                        className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm"
                                    >
                                        <option value="7d">Last 7 days</option>
                                        <option value="30d">Last 30 days</option>
                                        <option value="90d">Last 90 days</option>
                                    </select>
                                    <button
                                        onClick={() => setShowTrendAddForm(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700"
                                    >
                                        <Plus className="h-4 w-4" /> Add Data
                                    </button>
                                    <button onClick={() => setShowTrendExportPicker(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-600 text-teal-700 font-semibold hover:bg-teal-50">
                                        <Download className="h-4 w-4" /> Export
                                    </button>
                                </div>
                            </div>

                            {isLoadingReadings && <p className="text-sm text-slate-500">Loading trend charts...</p>}

                            {showTrendAddForm && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h4 className="text-lg font-bold text-slate-900 mb-4">Add Health Data</h4>
                                    <form onSubmit={handleAddTrendData} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">Date & Time</label>
                                            <input
                                                type="datetime-local"
                                                required
                                                value={trendForm.dateTime}
                                                onChange={(e) => setTrendForm({ ...trendForm, dateTime: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">Glucose (mg/dL)</label>
                                            <input
                                                type="number"
                                                min={20}
                                                max={600}
                                                required
                                                value={trendForm.glucose}
                                                onChange={(e) => setTrendForm({ ...trendForm, glucose: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">Weight (kg)</label>
                                            <input
                                                type="number"
                                                min={20}
                                                max={300}
                                                step="0.1"
                                                required
                                                value={trendForm.weight}
                                                onChange={(e) => setTrendForm({ ...trendForm, weight: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">HbA1c (%)</label>
                                            <input
                                                type="number"
                                                min={3}
                                                max={20}
                                                step="0.1"
                                                required
                                                value={trendForm.hba1c}
                                                onChange={(e) => setTrendForm({ ...trendForm, hba1c: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">Systolic (mmHg)</label>
                                            <input
                                                type="number"
                                                min={70}
                                                max={220}
                                                required
                                                value={trendForm.systolic}
                                                onChange={(e) => setTrendForm({ ...trendForm, systolic: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">Diastolic (mmHg)</label>
                                            <input
                                                type="number"
                                                min={40}
                                                max={140}
                                                required
                                                value={trendForm.diastolic}
                                                onChange={(e) => setTrendForm({ ...trendForm, diastolic: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-600 mb-1">Glucose Type</label>
                                            <select
                                                value={trendForm.glucoseType}
                                                onChange={(e) => setTrendForm({ ...trendForm, glucoseType: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-md"
                                            >
                                                <option value="fasting">Fasting</option>
                                                <option value="post-meal">Post-Meal</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-4 flex items-center justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setShowTrendAddForm(false)}
                                                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md font-medium hover:bg-slate-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSavingTrendData}
                                                className="px-5 py-2 bg-teal-600 text-white rounded-md font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                            >
                                                {isSavingTrendData ? "Saving..." : "Save All Metrics"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h4 className="text-3xl font-bold text-slate-900 mb-4">Blood Glucose Levels</h4>
                                    <div className="h-72">
                                        <Line
                                            data={{
                                                labels: trendLabels,
                                                datasets: [{
                                                    label: "Average Glucose",
                                                    data: glucoseSeries,
                                                    borderColor: "#0d9488",
                                                    backgroundColor: "rgba(13, 148, 136, 0.12)",
                                                    fill: true,
                                                    tension: 0.35,
                                                    pointRadius: 3,
                                                }],
                                            }}
                                            options={trendLineOptions}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h4 className="text-3xl font-bold text-slate-900 mb-4">Weight Progress</h4>
                                    <div className="h-72">
                                        <Line
                                            data={{
                                                labels: trendLabels,
                                                datasets: [{
                                                    label: "Weight",
                                                    data: weightSeries,
                                                    borderColor: "#3b82f6",
                                                    backgroundColor: "rgba(59, 130, 246, 0.12)",
                                                    fill: true,
                                                    tension: 0.35,
                                                    pointRadius: 3,
                                                }],
                                            }}
                                            options={trendLineOptions}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h4 className="text-3xl font-bold text-slate-900 mb-4">Blood Pressure</h4>
                                    <div className="h-72">
                                        <Line
                                            data={{
                                                labels: trendLabels,
                                                datasets: [
                                                    {
                                                        label: "Systolic",
                                                        data: systolicSeries,
                                                        borderColor: "#ef4444",
                                                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                                                        fill: false,
                                                        tension: 0.35,
                                                        pointRadius: 3,
                                                    },
                                                    {
                                                        label: "Diastolic",
                                                        data: diastolicSeries,
                                                        borderColor: "#10b981",
                                                        backgroundColor: "rgba(16, 185, 129, 0.1)",
                                                        fill: false,
                                                        tension: 0.35,
                                                        pointRadius: 3,
                                                    },
                                                ],
                                            }}
                                            options={trendLineOptions}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                    <h4 className="text-3xl font-bold text-slate-900 mb-4">HbA1c History</h4>
                                    <div className="h-72">
                                        <Bar
                                            data={{
                                                labels: trendLabels,
                                                datasets: [{
                                                    label: "HbA1c %",
                                                    data: hba1cSeries,
                                                    backgroundColor: "rgba(239, 68, 68, 0.65)",
                                                    borderRadius: 10,
                                                }],
                                            }}
                                            options={trendLineOptions}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>}

                        {showSection("doctors") && <div id="doctors" className="scroll-mt-24 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                            <h3 className="text-lg font-bold text-slate-900">Care Insights</h3>
                            <div className="flex items-start gap-3 text-sm text-slate-700">
                                <CalendarClock className="h-5 w-5 text-teal-600 mt-0.5" />
                                <p>Next check-in reminder: Tomorrow 8:00 AM</p>
                            </div>
                            <div className="flex items-start gap-3 text-sm text-slate-700">
                                <HeartPulse className="h-5 w-5 text-teal-600 mt-0.5" />
                                <p>Target glucose range: 80-140 mg/dL</p>
                            </div>
                            <p className="text-xs text-slate-500">Keep logging readings regularly to improve trend accuracy and alerts.</p>
                        </div>}
                    </div>}
                </div>
                )}

                {showSection("nutrition") && <div id="nutrition" className="scroll-mt-24 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Daily Guidance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-lg border border-teal-100 bg-teal-50 p-4">
                            <p className="text-sm font-semibold text-teal-800">Hydration</p>
                            <p className="text-xs text-teal-700 mt-1">Drink water consistently through the day to support stable glucose levels.</p>
                        </div>
                        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                            <p className="text-sm font-semibold text-amber-800">Meal Timing</p>
                            <p className="text-xs text-amber-700 mt-1">Track post-meal readings within 1-2 hours for better medication alignment.</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-800">Activity</p>
                            <p className="text-xs text-slate-700 mt-1">A short walk after meals may help reduce post-meal glucose spikes.</p>
                        </div>
                    </div>
                </div>}

                {showSection("reports") && <div id="reports" className="scroll-mt-24 space-y-5">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h3 className="text-3xl font-bold text-slate-900">Medical Reports</h3>
                            <p className="text-slate-500 mt-1">Welcome back, {patientName}! Here&apos;s your health summary.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 min-w-[280px]">
                                <Search className="h-4 w-4 text-slate-500" />
                                <input
                                    value={reportSearch}
                                    onChange={(e) => setReportSearch(e.target.value)}
                                    placeholder="Search records, reports..."
                                    className="bg-transparent outline-none text-sm text-slate-700 w-full"
                                />
                            </div>
                            <button className="relative h-11 w-11 inline-flex items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200">
                                <Bell className="h-4 w-4" />
                                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">3</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-900">
                            <FileText className="h-5 w-5 text-teal-600" />
                            <h4 className="text-2xl font-bold">Medical Reports</h4>
                        </div>
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700">
                            <Plus className="h-4 w-4" /> Add Report
                        </button>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="md:col-span-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                                <Search className="h-4 w-4 text-slate-500" />
                                <input
                                    value={reportSearch}
                                    onChange={(e) => setReportSearch(e.target.value)}
                                    placeholder="Search reports..."
                                    className="bg-transparent outline-none text-sm text-slate-700 w-full"
                                />
                            </div>
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value as "all" | "Lab Results" | "Diabetes" | "Imaging")}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm"
                            >
                                <option value="all">All Types</option>
                                <option value="Lab Results">Lab Results</option>
                                <option value="Diabetes">Diabetes</option>
                                <option value="Imaging">Imaging</option>
                            </select>
                            <select
                                value={reportTime}
                                onChange={(e) => setReportTime(e.target.value as "all" | "90d" | "1y")}
                                className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm"
                            >
                                <option value="all">All Time</option>
                                <option value="90d">Last 90 days</option>
                                <option value="1y">Last 1 year</option>
                            </select>
                            <button className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-teal-600 text-teal-700 font-semibold hover:bg-teal-50">
                                <Filter className="h-4 w-4" /> Filter
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-[860px] w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-600 text-left">
                                        <th className="px-4 py-3 font-semibold">REPORT NAME</th>
                                        <th className="px-4 py-3 font-semibold">TYPE</th>
                                        <th className="px-4 py-3 font-semibold">DATE</th>
                                        <th className="px-4 py-3 font-semibold">DOCTOR</th>
                                        <th className="px-4 py-3 font-semibold">STATUS</th>
                                        <th className="px-4 py-3 font-semibold">ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMedicalReports.map((report) => (
                                        <tr key={report.id} className="border-b border-slate-100 last:border-0">
                                            <td className="px-4 py-4 text-slate-900 font-medium">{report.name}</td>
                                            <td className="px-4 py-4 text-slate-700">{report.type}</td>
                                            <td className="px-4 py-4 text-slate-700">{report.date}</td>
                                            <td className="px-4 py-4 text-slate-900">{report.doctor}</td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                                    report.status === "Normal"
                                                        ? "bg-teal-100 text-teal-700"
                                                        : "bg-amber-100 text-amber-700"
                                                }`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleViewReport(report)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label={`View ${report.name}`}>
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDownloadReport(report)} className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200" aria-label={`Download ${report.name}`}>
                                                        <Download className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {isLoadingReports && (
                            <p className="text-sm text-slate-500">Loading reports...</p>
                        )}

                        {filteredMedicalReports.length === 0 && (
                            <p className="text-sm text-slate-500">No reports found for these filters.</p>
                        )}
                    </div>
                </div>}

                {showSection("personal") && <div id="personal" className="scroll-mt-24 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Personal Data</h3>
                    <p className="text-sm text-slate-600">Keep your profile and emergency contact details updated for better care coordination.</p>
                </div>}
                </div>
                </main>
            </div>

            {showTrendExportPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setShowTrendExportPicker(false)}>
                    <div
                        className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Export health trends"
                    >
                        <div className="px-5 py-4 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-900">Export Health Trends</h3>
                            <p className="text-sm text-slate-500 mt-1">Choose your export format.</p>
                        </div>
                        <div className="px-5 py-4 space-y-2">
                            <button onClick={handleExportTrendsCsv} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 font-medium hover:bg-slate-50">
                                Download CSV
                            </button>
                            <button onClick={handleExportTrendsPdf} className="w-full px-4 py-2.5 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700">
                                Export PDF
                            </button>
                        </div>
                        <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
                            <button onClick={() => setShowTrendExportPicker(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={closeReportModal}>
                    <div
                        className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Medical report details"
                    >
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Report Details</h3>
                            <button
                                onClick={closeReportModal}
                                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                                aria-label="Close report details"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4 text-sm">
                            <div>
                                <p className="text-slate-500">Report Name</p>
                                <p className="text-slate-900 font-semibold mt-1">{selectedReport.name}</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-500">Type</p>
                                    <p className="text-slate-900 mt-1">{selectedReport.type}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Status</p>
                                    <p className="text-slate-900 mt-1">{selectedReport.status}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Doctor / Source</p>
                                    <p className="text-slate-900 mt-1">{selectedReport.doctor}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Date</p>
                                    <p className="text-slate-900 mt-1">{selectedReport.date}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-slate-500">Timestamp</p>
                                <p className="text-slate-900 mt-1">{new Date(selectedReport.timestamp).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                            <button
                                onClick={() => handleDownloadReport(selectedReport)}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700"
                            >
                                <Download className="h-4 w-4" /> Download CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
