import React, { useState, useEffect } from 'react';
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody, TableFooter } from "@/components/ui/table";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/config/api';
import { Skeleton } from "@/components/ui/skeleton";

const StudentAdvisingForms = ({ academicYear, semester }) => {
  const { user } = useAuth();
  const [advisedCourses, setAdvisedCourses] = useState([]);
  const [gradedCourses, setGradedCourses] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [advisorName, setAdvisorName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAdvisedCourses = async () => {
      if (!user || !user.student_id || !academicYear || !semester) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/student/read_advised_courses.php?student_id=${user.student_id}&academic_year=${academicYear}&semester=${semester}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("API Response:", data); // Debug log
        setAdvisedCourses(data.advised_courses || []);
        setGradedCourses(data.graded_courses || []);
        setAdvisorName(data.advisor_name);
      } catch (error) {
        console.error("Error fetching advised courses:", error);
        setError("Failed to load advising records.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdvisedCourses();
  }, [user, academicYear, semester]);

  useEffect(() => {
    const fetchStudentProfile = async () => {
      if (!user || !user.student_id) {
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/student/read_student_advising_profile.php?student_id=${user.student_id}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setStudentProfile(data);
      } catch (error) {
        console.error("Error fetching student profile:", error);
      }
    };
    fetchStudentProfile();
  }, [user]);

  if (loading || !studentProfile) {
    return (
      <div className="p-2">
        <div className="max-w-5xl mx-auto">
          <div className="border rounded-md p-2 shadow-sm">
            <div className="mb-2 overflow-x-auto">
              <Skeleton className="w-full h-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error: {error}</div>;
  }

  const { 
    student_name, 
    student_number, 
    institute_name, 
    program_year_section, 
    student_status, 
    current_enrollment_period, 
    next_enrollment_period
  } = studentProfile;

  // Get failed courses from graded courses
  const failedCourses = gradedCourses.filter(course => course.remarks === "Failed");

  // Exclude failed courses from main graded courses
  const nonFailedGradedCourses = gradedCourses.filter(course => course.remarks !== "Failed");

  // Calculate total units for advised courses
  const totalAdvisedUnits = advisedCourses.reduce((sum, record) => sum + (record.units || 0), 0);

  // Calculate total units earned from graded courses (passed courses only)
  const totalUnitsEarned = gradedCourses
    .filter(course => course.remarks === "Passed" || course.grade) // Only count courses with grades/passed
    .reduce((sum, course) => {
      // Parse units from course data - you may need to adjust this based on your data structure
      const units = parseFloat(course.units) || 0;
      return sum + units;
    }, 0);

  return (
    <div>
      <div className="max-w-5xl mx-auto">
        <div className="border rounded-md p-2 shadow-sm">
          <div className="mb-2 overflow-x-auto">
            <Table className="border">
              <TableHeader>
                <TableRow>   
                  <TableHead colSpan={4} className="w-[60%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Name : {student_name}</TableHead>
                  <TableHead colSpan={3} className="w-[40%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Student No : {student_number}</TableHead>            
                </TableRow>
                
                <TableRow>   
                  <TableHead colSpan={2} className="w-[30%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Institute : {institute_name}</TableHead>
                  <TableHead colSpan={2} className="w-[30%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Program/Year/Section : {program_year_section}</TableHead>
                  <TableHead colSpan={3} className="w-[40%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Status : {student_status}</TableHead>            
                </TableRow>
                
                <TableRow>
                  <TableHead colSpan={4} className="w-[60%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">LAST ENROLLMENT : {current_enrollment_period}</TableHead>
                  <TableHead colSpan={3} className="w-[40%] text-left border-b border-r px-2 py-1 text-xs font-normal h-6">CURRENT ENROLLMENT : {next_enrollment_period}</TableHead>
                </TableRow>
              
                <TableRow>
                  <TableHead className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs">Course Code</TableHead>
                  <TableHead className="w-[25%] text-center border-b border-r px-2 py-1 text-xs">Course Title</TableHead>
                  <TableHead className="w-[10%] text-center border-b border-r px-2 py-1 text-xs">Grade</TableHead>
                  <TableHead className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs">Pre-requisite</TableHead>
                  <TableHead className="w-[25%] text-center border-b border-r px-2 py-1 text-xs">Course Code and Title</TableHead>
                  <TableHead className="w-[5%] text-center border-b border-r px-2 py-1 text-xs">Units</TableHead>
                  <TableHead className="w-[10%] text-center border-b border-r px-2 py-1 text-xs">Adviser's Signature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Display rows with graded courses (left) and advised courses (right) */}
                {Array.from({ length: Math.max(nonFailedGradedCourses.length, advisedCourses.length) }).map((_, index) => {
                  const gradedCourse = nonFailedGradedCourses[index];
                  const advisedCourse = advisedCourses[index];

                  return (
                    <TableRow key={index}>
                      {/* Left side - Graded courses from last enrollment */}
                      <TableCell className="w-[12.5%] text-left border-r px-2 py-1 text-xs">
                        {gradedCourse?.course_code || ''}
                      </TableCell>
                      <TableCell className="w-[25%] text-left border-r px-2 py-1 text-xs">
                        {gradedCourse?.course_title || ''}
                      </TableCell>
                      <TableCell className="w-[10%] text-center border-r px-2 py-1 text-xs">
                        {gradedCourse?.grade || ''}
                      </TableCell>
                      {/* Show prerequisites from graded courses */}
                      <TableCell className="w-[12.5%] text-left border-r px-2 py-1 text-xs">
                        {gradedCourse?.prerequisite_code || ''}
                      </TableCell>

                      {/* Right side - Advised courses for current enrollment */}
                      <TableCell className="w-[25%] text-left border-r px-2 py-1 text-xs">
                        {advisedCourse ? `${advisedCourse.course_code} - ${advisedCourse.course_title}` : ''}
                      </TableCell>
                      <TableCell className="w-[5%] text-center border-r px-2 py-1 text-xs">
                        {advisedCourse?.units || ''}
                      </TableCell>
                      <TableCell className="w-[10%] text-center px-2 py-1 text-xs"></TableCell>
                    </TableRow>
                  );
                })}

                {/* Show message if no data */}
                {gradedCourses.length === 0 && advisedCourses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-sm text-muted-foreground">
                      No records found.
                    </TableCell>
                  </TableRow>
                )}

                {/* Failed courses section */}
                {failedCourses.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={4} className="w-[60%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Failed course/s</TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs"></TableCell>
                      <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs"></TableCell> 
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs"></TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="w-[12.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Course Code</TableCell>
                      <TableCell className="w-[25%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Course Title</TableCell>
                      <TableHead className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Grade</TableHead>
                      <TableCell className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Term</TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">AY</TableCell>
                      <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                    </TableRow>

                    {failedCourses.map((failedRecord, idx) => (
                      <TableRow key={`failed-${idx}`}>
                        <TableCell className="w-[12.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6">{failedRecord.course_code}</TableCell>
                        <TableCell className="w-[25%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">{failedRecord.course_title}</TableCell>
                        <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">{failedRecord.grade || "N/A"}</TableCell>
                        <TableCell className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">{failedRecord.semester_name}</TableCell>
                        <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">{failedRecord.academic_year_name}</TableCell>
                        <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                        <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

              </TableBody>

              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="w-[47.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6">Total number of units earned : {totalUnitsEarned} Units</TableCell>
                  <TableCell colSpan={4} className="w-[52.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Total number of units to be enrolled : {totalAdvisedUnits} Units</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="w-[47.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6">Student's Signature : </TableCell>
                  <TableCell colSpan={4} className="w-[52.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Adviser's Printed Name : {advisorName?.toUpperCase() || "N/A"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={3} className="w-[47.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6"></TableCell>
                  <TableCell colSpan={4} className="w-[52.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Student's Printed Name : {student_name?.toUpperCase() || "N/A"}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentAdvisingForms;