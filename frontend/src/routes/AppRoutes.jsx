import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginPage from "@/pages/auth/LoginPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ActiveUsers from "@/pages/admin/ActiveUsers";
import ArchivedUsers from "@/pages/admin/ArchivedUsers";
import AuditTrail from "@/pages/admin/AuditTrail";
import StudentHome from "@/pages/student/StudentHome";
import FacultyHome from "@/pages/faculty/FacultyHome";
import AdvisingPage from "@/pages/faculty/AdvisingPage";
import CreditCourses from "@/pages/faculty/CreditCourses";
import ProgramChairHome from "@/pages/program-chair/ProgramChairHome";
import ProgramChairManageCurriculum from "@/pages/program-chair/ManageCurriculum";
import DeanHome from "@/pages/dean/DeanHome";
import ProtectedRoute from "@/routes/ProtectedRoute";
import ManageGrades from "@/pages/faculty/ManageGrades";
import ManageCurriculum from "@/pages/admin/ManageCurriculum";
import StudentCurriculum from "@/pages/student/StudentCurriculum";
import ManageFaculty from "@/pages/program-chair/ManageFaculty";
import FacultyAssignment from "@/pages/program-chair/FacultyAssignment";
import ManageSections from "@/pages/program-chair/ManageSections";
import StudentAdvisingRecords from "@/pages/student/StudentAdvisingRecords";
import RoleSelectionPage from "@/pages/auth/RoleSelectionPage"; // Import new RoleSelectionPage
import AdvisingPeriodManager from "@/pages/dean/AdvisingPeriodManager"; // Import the new component
import ExportAdvisingForms from "@/pages/dean/ExportAdvisingForms"; // Import the new component
import DeanReportGenerator from "@/pages/dean/DeanReportGenerator"; // Import the new component
import NotificationsManagement from "@/pages/NotificationsManagement"; // Import the new component
import SetPasswordForm from "@/components/SetPasswordForm"; // Import SetPasswordForm
import { useContext } from "react"; // Import useContext
import { AuthContext } from "@/contexts/AuthContext"; // Import AuthContext


export default function AppRoutes() {
  const { user, activeRole } = useContext(AuthContext); // Access user and activeRole

  console.log("AppRoutes: Rendering."); // LOG
  console.log("AppRoutes: User", user); // LOG
  console.log("AppRoutes: activeRole", activeRole); // LOG

  return (
    <Routes>
      
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route
        path="/login"
        element={
          <ErrorBoundary>
            <LoginPage />
          </ErrorBoundary>
        }
      />

      {/* New Role Selection Route */}
      <Route
        path="/role-selection"
        element={
          <ErrorBoundary>
            <RoleSelectionPage />
          </ErrorBoundary>
        }
      />
  
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRoles="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users/active-users"
        element={
          <ProtectedRoute requiredRoles="admin">
            <ActiveUsers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users/archived-users"
        element={
          <ProtectedRoute requiredRoles="admin">
            <ArchivedUsers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/academic-structure"
        element={
          <ProtectedRoute requiredRoles="admin">
            <ManageCurriculum />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/audit-logs"
        element={
          <ProtectedRoute requiredRoles="admin">
            <AuditTrail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/faculty/grades"
        element={
          <ProtectedRoute requiredRoles="faculty">
            <ManageGrades />
          </ProtectedRoute>
        }
      />

      <Route
        path="/faculty/advise"
        element={
          <ProtectedRoute requiredRoles="faculty">
            <AdvisingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/faculty/credit-courses/:studentId"
        element={
          <ProtectedRoute requiredRoles="faculty">
            <CreditCourses />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/home"
        element={
          <ProtectedRoute requiredRoles="student">
            <StudentHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/advising-records"
        element={
          <ProtectedRoute requiredRoles="student">
            <StudentAdvisingRecords />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/curriculum"
        element={
          <ProtectedRoute requiredRoles="student">
            <StudentCurriculum />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/home"
        element={
          <ProtectedRoute requiredRoles="faculty">
            <FacultyHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/program-chair/home"
        element={
          <ProtectedRoute requiredRoles="programchair">
            <ProgramChairHome />
          </ProtectedRoute>
        }
      />
      
      
      <Route
        path="/program-chair/curriculum"
        element={
          <ProtectedRoute requiredRoles="programchair">
            <ProgramChairManageCurriculum />
          </ProtectedRoute>
        }
      />

      <Route
        path="/program-chair/manage-faculty"
        element={
          <ProtectedRoute requiredRoles="programchair">
            <ManageFaculty />
          </ProtectedRoute>
        }
      />

      <Route
        path="/program-chair/faculty-assignment/:facultyId"
        element={
          <ProtectedRoute requiredRoles="programchair">
            <FacultyAssignment />
          </ProtectedRoute>
        }
      />

      <Route
        path="/program-chair/manage-sections"
        element={
          <ProtectedRoute requiredRoles="programchair">
            <ManageSections />
          </ProtectedRoute>
        }
      />

      
      
      <Route
        path="/dean/home"
        element={
          <ProtectedRoute requiredRoles="dean">
            <DeanHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dean/advising-period"
        element={
          <ProtectedRoute requiredRoles="dean">
            <AdvisingPeriodManager />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dean/advising-forms"
        element={
          <ProtectedRoute requiredRoles="dean">
            <ExportAdvisingForms />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dean/generate-reports"
        element={
          <ProtectedRoute requiredRoles="dean">
            <DeanReportGenerator />
          </ProtectedRoute>
        }
      />

      {/* New Route for Notifications (accessible by all roles) */}
      <Route
        path="/notifications"
        element={
          <ProtectedRoute requiredRoles={["admin", "faculty", "student", "programchair", "dean"]}>
            <NotificationsManagement />
          </ProtectedRoute>
        }
      />

      {/* Route for setting password, accessible without authentication */}
      <Route
        path="/set-password/:userId"
        element={
          <ErrorBoundary>
            <SetPasswordForm />
          </ErrorBoundary>
        }
      />
     
      {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
    </Routes>
  );
}
