import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/shared/DatePicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusSquare } from "lucide-react";
import eventService from "@/services/eventService";
import { API_BASE_URL } from '@/config/api';
import { useActive } from "@/contexts/ActiveContext";

export function CreateAccountModal({onAccountCreated}) {

  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [dob, setDob] = useState("");

  const [emailModified, setEmailModified] = useState(false);

  const [employeeId, setEmployeeId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [department, setDepartment] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [entryYear, setEntryYear] = useState("");

  const [entryYearName, setEntryYearName] = useState("");

  const { activeAcademicYear, activeSemester } = useActive();

  const selectedDepartment = departments.find((dept) => dept.name === department);
  const departmentId = selectedDepartment ? selectedDepartment.id : null;

  const selectedProgram = programs.find((prog) => prog.name === program);
  const programId = selectedProgram ? selectedProgram.id : null;

  const selectedYearLevel = yearLevels.find((year) => year.level === yearLevel);
  const yearLevelId = selectedYearLevel ? selectedYearLevel.id : null;


  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const departmentResponse = await fetch(`${API_BASE_URL}/users/departments.php`);
        const departmentData = await departmentResponse.json();
        setDepartments(departmentData);

        const programResponse = await fetch(`${API_BASE_URL}/users/programs.php`);
        const programData = await programResponse.json();
        setPrograms(programData);

        const yearLevelResponse = await fetch(`${API_BASE_URL}/users/year_levels.php`);
        const yearLevelData = await yearLevelResponse.json();
        setYearLevels(yearLevelData);

        const sectionResponse = await fetch(`${API_BASE_URL}/users/sections.php`);
        const sectionData = await sectionResponse.json();
        setSections(sectionData);

        const academicYearResponse = await fetch(`${API_BASE_URL}/academic_year/read.php`);
        const academicYearData = await academicYearResponse.json();
        setAcademicYears(academicYearData);
        console.log("Academic Years:", academicYearData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);


  useEffect(() => {
    if (!emailModified) {
      const getInitials = (name) =>
        name
          .split(/\s+/)
          .filter(Boolean)
          .map((word) => word.charAt(0).toLowerCase())
          .join("");
      const firstInitials = getInitials(firstName);
      const middleInitials = getInitials(middleName);
      const lastPart = lastName.trim().toLowerCase();
      if (lastPart) {
        setEmail(`${firstInitials}${middleInitials}${lastPart}@kld.edu.ph`);
      } else {
        setEmail("");
      }
    }
  }, [firstName, middleName, lastName, emailModified]);

  const resetForm = () => {
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setEmail("");
    setEmailModified(false);
    setRole("");
    setDob("");
    setEmployeeId("");
    setStudentId("");
    setDepartment("");
    setProgram("");
    setYearLevel("");
    setSection("");
    setEntryYear("");
    setEntryYearName("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = {
      firstName,
      middleName,
      employeeId,
      lastName,
      email,
      role,
      dob,
      
    };

    

    if (role === "admin") {
      formData.employeeId = employeeId;
    
      try {
        const response = await fetch(`${API_BASE_URL}/users/create_system_admin.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
    
        const result = await response.json();
        console.log(result);
    
        if (response.ok) {
          alert("System admin account created successfully!");
          resetForm();
          onAccountCreated();
        } else {
          alert(result.message || "Failed to create system admin account.");
        }
      } catch (error) {
        console.error("Error creating account:", error);
        alert("An error occurred while creating the account.");
      }
    } else if (role === "dean") {
      formData.employeeId = employeeId;
      formData.department = department;
    
      try {
        const response = await fetch(`${API_BASE_URL}/users/create_dean.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
    
        const result = await response.json();
        console.log(result);
    
        if (response.ok) {
          alert("Dean account created successfully!");
          resetForm();
          onAccountCreated();
        } else {
          alert(result.message || "Failed to create dean account.");
        }
      } catch (error) {
        console.error("Error creating account:", error);
        alert("An error occurred while creating the account.");
      }
    }  else if (role === "programchair") {
      formData.employeeId = employeeId;
      formData.department = department;
      formData.program = program;

      try {
        const response = await fetch(`${API_BASE_URL}/users/create_program_chair.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
    
        const result = await response.json();
        console.log(result);
    
        if (response.ok) {
          alert("Program Chair account created successfully!");
          resetForm();
          onAccountCreated();
        } else {
          alert(result.message || "Failed to create program chair account.");
        }
      } catch (error) {
        console.error("Error creating account:", error);
        alert("An error occurred while creating the account.");
      }
    } else if (role === "faculty") {
      formData.employeeId = employeeId;
      formData.department = department;
      formData.specialization = specialization;

      try {
        const response = await fetch(`${API_BASE_URL}/users/create_faculty.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
    
        const result = await response.json();
        console.log("Faculty creation API response:", result);
    
        if (response.ok) {
          alert("Faculty account created successfully!");
          
          // Create a new faculty object that matches the format expected by AdvisorsList
          const newFaculty = {
            id: result.id || result.faculty_id || result.user_id || Math.random().toString(36).substr(2, 9),
            name: `${firstName} ${lastName}`,
            employee_id: employeeId,
            department: department,
            department_id: departmentId,
            specialization: specialization,
            sections: [], // New faculty has no sections assigned yet
            timestamp: new Date().getTime()
          };
          
          console.log("Emitting faculty_account_created event with faculty:", newFaculty);
          
          // Emit the event with the new faculty object
          window.setTimeout(() => {
            eventService.emit('faculty_account_created', { faculty: newFaculty });
          }, 0);
          
          resetForm();
          onAccountCreated();
        } else {
          alert(result.message || "Failed to create faculty account.");
        }
      } catch (error) {
        console.error("Error creating account:", error);
        alert("An error occurred while creating the account.");
      }
    } else if (role === "student") {
      formData.studentId = studentId;
      formData.department = department;
      formData.program = program;
      formData.yearLevel = yearLevel;
      formData.section = section;
      formData.entryYear = entryYear;

      try {
        const response = await fetch(`${API_BASE_URL}/users/create_student.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
    
        const result = await response.json();
        console.log(result);
    
        if (response.ok) {
          alert("Student account created successfully!");
          resetForm();
          onAccountCreated();
        } else {
          alert(result.message || "Failed to create student account.");
        }
      } catch (error) {
        console.error("Error creating account:", error);
        alert("An error occurred while creating the account.");
      }
    }
    console.log("Submitting account data:", formData);
    
  };

  return (
    <Dialog onOpenChange={(open) => { if (!open) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="p-2">
          <PlusSquare size={24} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
          <DialogDescription>
            Fill in the form below to create a new account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Middle name"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailModified(true);
                }}
                placeholder="Enter email"
              />
            </div>
            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <DatePicker value={dob} onChange={setDob} />
            </div>
          </div>

          <div>
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">System Admin</SelectItem>
                <SelectItem value="dean">Dean</SelectItem>
                <SelectItem value="programchair">Program Chair</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "admin" && (
            <div>
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="Employee ID"
              />
            </div>
          )}

          {role === "dean" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Employee ID"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={department} onValueChange={(value) => {
                  
                  setDepartment(value);
                  }}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

              </div>
            </div>
          )}

          {role === "programchair" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Employee ID"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
  <Label htmlFor="program">Program</Label>
  <Select value={program} onValueChange={(value) => {
  if (role === "programchair") {
    const selectedProgram = programs.find(prog => prog.id === value);
    if (selectedProgram) {
      setProgram(selectedProgram.id); 
    }
  } else {
    setProgram(value);
  }
}}>
    <SelectTrigger id="program">
      <SelectValue placeholder="Select program" />
    </SelectTrigger>
    <SelectContent>
  {console.log('Selected departmentId:', departmentId)}
  {console.log('Programs:', programs)}
  {console.log('Filtered programs:', programs.filter((prog) => prog.department_id === departmentId))}
  {departmentId && programs.filter((prog) => prog.department_id === departmentId).length > 0 ? (
    programs
      .filter((prog) => prog.department_id === departmentId)
      .map((prog) => (
        <SelectItem key={prog.id} value={prog.id}>
          {prog.name}
        </SelectItem>
      ))
  ) : (
    <SelectItem disabled value="none">
      No programs available
    </SelectItem>
  )}
</SelectContent>




  </Select>
</div>

            </div>
          )}

          {role === "faculty" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Employee ID"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                  {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                </SelectContent>
                </Select>
              </div>
              
            </div>
          )}

          {role === "student" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="studentId">Student ID</Label>
                  <Input
                    id="studentId"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Student ID"
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="program">Program</Label>
                  <Select value={program} onValueChange={setProgram}>
                    <SelectTrigger id="program">
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                   <SelectContent>
                      {departmentId && programs.filter((prog) => prog.department_id === departmentId).length > 0 ? (
                        programs
                          .filter((prog) => prog.department_id === departmentId)
                          .map((prog) => (
                            <SelectItem key={prog.id} value={prog.name}>
                              {prog.name}
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem disabled value="none">
                          No programs available
                        </SelectItem>
                      )}
                    </SelectContent>

                  </Select>
                </div>
                <div>
                  <Label htmlFor="yearLevel">Year Level</Label>
                  <Select value={yearLevel} onValueChange={setYearLevel}>
                    <SelectTrigger id="yearLevel">
                      <SelectValue placeholder="Select year level" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearLevels.map((year) => (
                        <SelectItem key={year.id} value={year.level}>
                          {year.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="section">Section</Label>
                  <Select value={section} onValueChange={setSection}>
                    <SelectTrigger id="section">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {console.log('Program ID:', programId, 'Year Level ID:', yearLevelId, 'Active Academic Year:', activeAcademicYear, 'Active Semester:', activeSemester)}
                      {console.log('All Sections:', sections)}
                      {programId && yearLevelId && activeAcademicYear && activeSemester ? (
                        sections
                          .filter((sec) => {
                            console.log('Filtering section:', sec.name, 'Program ID Match:', sec.program_id === programId, 'Year Level ID Match:', sec.year_level_id === yearLevelId, 'Academic Year ID Match:', sec.academic_year_id === activeAcademicYear.id, 'Semester ID Match:', sec.semester_id === activeSemester.id);
                            return (
                              sec.program_id === programId && 
                              sec.year_level_id === yearLevelId &&
                              sec.academic_year_id === activeAcademicYear.id &&
                              sec.semester_id === activeSemester.id
                            );
                          })
                          .map((sec) => (
                            <SelectItem key={sec.id} value={sec.name}>
                              {sec.name}
                            </SelectItem>
                          ))
                      ) : (
                        <SelectItem disabled value="none">
                          No sections available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="entryYear">Entry Year</Label>
                  <Select value={entryYear} onValueChange={(value) => {
                    console.log("Selected Entry Year Value:", value);
                    setEntryYear(value);

                    const selectedYear = academicYears.find(year => year.id === value);
                    if (selectedYear) {
                      setEntryYearName(selectedYear.year);
                    }
                  }}>
                    <SelectTrigger id="entryYear">
                      <SelectValue placeholder="Select entry year">{entryYearName || "Select entry year"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((year) => {
                        console.log("Year ID:", year.id, "Year:", year.year);
                        return (
                          <SelectItem key={year.id} value={year.id}>
                            {year.year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="submit" variant="green" onClick={handleSubmit}>
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
