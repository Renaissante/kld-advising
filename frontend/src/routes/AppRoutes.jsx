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
        path="/admin/curriculum"
        element={
          <ProtectedRoute requiredRoles="admin">
            <ManageCurriculum />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/audit-trail"
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
        path="/dean/export-advising-forms"
        element={
          <ProtectedRoute requiredRoles="dean">
            <ExportAdvisingForms />
          </ProtectedRoute>
        }
      />

     
      {/* <Route path="*" element={<Navigate to="/login" replace />} /> */}
    </Routes>
  );
}
