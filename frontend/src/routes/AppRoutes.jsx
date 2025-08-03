import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import LoginPage from "@/pages/auth/LoginPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import ManageUsers from "@/pages/admin/ManageUsers";
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
import StudentAdvisingRecords from "@/pages/student/StudentAdvisingRecords";

export default function AppRoutes() {
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

  
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute role="admin">
            <ManageUsers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/curriculum"
        element={
          <ProtectedRoute role="admin">
            <ManageCurriculum />
          </ProtectedRoute>
        }
      />

      <Route
        path="/faculty/grades"
        element={
          <ProtectedRoute role="faculty">
            <ManageGrades />
          </ProtectedRoute>
        }
      />

      <Route
        path="/faculty/advise"
        element={
          <ProtectedRoute role="faculty">
            <AdvisingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/home"
        element={
          <ProtectedRoute role="student">
            <StudentHome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/advising-records"
        element={
          <ProtectedRoute role="student">
            <StudentAdvisingRecords />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/curriculum"
        element={
          <ProtectedRoute role="student">
            <StudentCurriculum />
          </ProtectedRoute>
        }
      />
      <Route
        path="/faculty/home"
        element={
          <ProtectedRoute role="faculty">
            <FacultyHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/program-chair/home"
        element={
          <ProtectedRoute role="programchair">
            <ProgramChairHome />
          </ProtectedRoute>
        }
      />
      
      
      <Route
        path="/program-chair/curriculum"
        element={
          <ProtectedRoute role="programchair">
            <ProgramChairManageCurriculum />
          </ProtectedRoute>
        }
      />

      <Route
        path="/program-chair/manage-faculty"
        element={
          <ProtectedRoute role="programchair">
            <ManageFaculty />
          </ProtectedRoute>
        }
      />

      <Route
        path="/program-chair/faculty-assignment/:facultyId"
        element={
          <ProtectedRoute role="programchair">
            <FacultyAssignment />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/dean/home"
        element={
          <ProtectedRoute role="dean">
            <DeanHome />
          </ProtectedRoute>
        }
      />

     
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
