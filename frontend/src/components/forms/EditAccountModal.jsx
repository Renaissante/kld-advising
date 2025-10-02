import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL } from "@/config/api";
import { useActive } from "@/contexts/ActiveContext";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox

export function EditAccountModal({ isOpen, onClose, userData, onAccountUpdated }) {
  console.log('EditAccountModal received userData:', userData); // Re-add this line for debugging
  const [formData, setFormData] = useState({
    id: "",
    KLD_ID: "",
    name: "",
    email: "",
    // role: "", // Removed role from formData
    department_id: "",
    program_id: "",
    year_level_id: "",
    section_id: "",
    advisor_id: "",
    // specialization: "", // Added specialization for faculty
  });
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);
  const [sections, setSections] = useState([]);
  const [facultyAdvisors, setFacultyAdvisors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]); // New state for all available roles
  const [selectedRoles, setSelectedRoles] = useState([]); // New state for roles selected for the user

  const { activeAcademicYear, activeSemester } = useActive();

  const [filteredPrograms, setFilteredPrograms] = useState([]);
  const [filteredSections, setFilteredSections] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  // Initialize formData and selectedRoles when userData changes
  useEffect(() => {
    if (userData) {
      setFormData({
        id: userData.id || "",
        KLD_ID: userData.KLD_ID || "",
        name: userData.name || "",
        email: userData.email || "",
        // role: userData.role || "", // Removed role from formData
        department_id: userData.department_id ? String(userData.department_id) : "",
        program_id: userData.program_id ? String(userData.program_id) : "",
        year_level_id: userData.year_level_id ? String(userData.year_level_id) : "",
        section_id: userData.section_id ? String(userData.section_id) : "",
        advisor_id: userData.advisor_id ? String(userData.advisor_id) : "",
        // specialization: userData.specialization || "", // Initialize specialization
      });
      // Initialize selectedRoles from userData.roles (comma-separated string)
      if (userData.roles) {
        setSelectedRoles(userData.roles.split(',').map(role => role.trim()));
      } else {
        setSelectedRoles([]);
      }
    }
  }, [userData]);

  // Fetch all dropdown data and available roles
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [
          departmentsRes,
          programsRes,
          yearLevelsRes,
          sectionsRes,
          facultyRes,
          academicYearRes,
          rolesRes, // New: fetch all roles
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/users/departments.php`),
          fetch(`${API_BASE_URL}/users/programs.php`),
          fetch(`${API_BASE_URL}/users/year_levels.php`),
          fetch(`${API_BASE_URL}/users/sections.php`),
          fetch(`${API_BASE_URL}/program_chair/read_assignment.php`), // Corrected endpoint for faculty advisors
          fetch(`${API_BASE_URL}/academic_year/read.php`),
          fetch(`${API_BASE_URL}/users/roles.php`), // New endpoint for roles
        ]);

        const [departmentsData, programsData, yearLevelsData, sectionsData, facultyData, academicYearData, rolesData] = await Promise.all([
          departmentsRes.json(),
          programsRes.json(),
          yearLevelsRes.json(),
          sectionsRes.json(),
          facultyRes.json(),
          academicYearRes.json(),
          rolesRes.json(), // Parse roles data
        ]);

        setDepartments(departmentsData);
        setPrograms(programsData);
        setYearLevels(yearLevelsData);
        setSections(sectionsData);
        setFacultyAdvisors(facultyData);
        setAcademicYears(academicYearData);
        setAvailableRoles(rolesData); // Set available roles

      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        toast.error("Failed to load necessary data for editing.");
      }
    };
    fetchDropdownData();
  }, []);

  useEffect(() => {
    if (formData.department_id) {
      const programsInDepartment = programs.filter(prog => String(prog.department_id) === formData.department_id);
      setFilteredPrograms(programsInDepartment);
      // If the current program is not in the newly filtered list, reset it
      if (!programsInDepartment.some(prog => String(prog.id) === formData.program_id)) {
        setFormData(prev => ({ ...prev, program_id: "", section_id: "" }));
      }
    } else {
      setFilteredPrograms([]);
      setFormData(prev => ({ ...prev, program_id: "", section_id: "" }));
    }
  }, [formData.department_id, programs]);

  useEffect(() => {
    if (formData.program_id && formData.year_level_id && activeAcademicYear && activeSemester) {
      const sectionsInProgramAndYear = sections.filter(sec => 
        String(sec.program_id) === formData.program_id &&
        String(sec.year_level_id) === formData.year_level_id &&
        String(sec.academic_year_id) === String(activeAcademicYear.id) &&
        String(sec.semester_id) === String(activeSemester.id)
      );
      setFilteredSections(sectionsInProgramAndYear);
      // If the current section is not in the newly filtered list, reset it
      if (!sectionsInProgramAndYear.some(sec => String(sec.id) === formData.section_id)) {
        setFormData(prev => ({ ...prev, section_id: "" }));
      }
    } else {
      setFilteredSections([]);
      setFormData(prev => ({ ...prev, section_id: "" }));
    }
  }, [formData.program_id, formData.year_level_id, sections, activeAcademicYear, activeSemester]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (id, value) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (id === "department_id") {
      setFormData((prev) => ({ ...prev, program_id: "", section_id: "" }));
    } else if (id === "program_id" || id === "year_level_id") {
      setFormData((prev) => ({ ...prev, section_id: "" }));
    }
  };

  // Handle role checkbox changes
  const handleRoleCheckboxChange = (roleName, isChecked) => {
    setSelectedRoles((prev) => {
      if (isChecked) {
        return [...prev, roleName];
      } else {
        return prev.filter((role) => role !== roleName);
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = { ...formData, roles: selectedRoles }; // Send roles array in payload
      const response = await fetch(`${API_BASE_URL}/users/update_user.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("Update response result:", result);

      if (result.success) {
        toast.success(result.message);
        onAccountUpdated();
        onClose();
      } else {
        toast.error(result.message || "Failed to update account.");
      }
    } catch (error) {
      console.error("Error updating account:", error);
      toast.error("Network error or server unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to check if a user has a specific role (for conditional rendering)
  const userHasRole = (roleName) => userData.roles && userData.roles.includes(roleName);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User Account</DialogTitle>
          <DialogDescription>
            Make changes to the user's profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="KLD_ID">
              KLD ID
            </Label>
            <Input
              id="KLD_ID"
              value={formData.KLD_ID}
              onChange={handleChange}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">
              Name
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          {/* Role Management Section */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="roles">
              Roles
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <div key={role.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoles.includes(role.name)}
                    onCheckedChange={(checked) => handleRoleCheckboxChange(role.name, checked)}
                  />
                  <Label htmlFor={`role-${role.id}`}>{role.name}</Label>
                </div>
              ))}
            </div>
          </div>

          {(selectedRoles.includes("faculty") || selectedRoles.includes("programchair") || selectedRoles.includes("dean") || selectedRoles.includes("admin")) && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="department_id">
                Department
              </Label>
              <Select
                onValueChange={(value) => handleSelectChange("department_id", value)}
                value={String(formData.department_id || '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department">
                    {formData.department_id && departments.find(dept => String(dept.id) === formData.department_id)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditionally render Program for student and programchair */}
          {(selectedRoles.includes("student") || selectedRoles.includes("programchair")) && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="program_id">
                Program
              </Label>
              <Select
                onValueChange={(value) => handleSelectChange("program_id", value)}
                value={String(formData.program_id || '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program">
                    {formData.program_id && filteredPrograms.find(program => String(program.id) === formData.program_id)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredPrograms.length > 0 ? (
                    filteredPrograms.map((program) => (
                      <SelectItem key={program.id} value={String(program.id)}>
                        {program.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="none">
                      No programs available for this department
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditionally render Year Level, Section, and Advisor ONLY for student */}
          {selectedRoles.includes("student") && (
            <>
              <div className="flex gap-4">
                <div className="flex flex-col gap-2 w-1/2">
                  <Label htmlFor="year_level_id">
                    Year Level
                  </Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("year_level_id", value)}
                    value={String(formData.year_level_id || '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a year level">
                        {formData.year_level_id && yearLevels.find(year => String(year.id) === formData.year_level_id)?.level}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {yearLevels.map((year) => (
                        <SelectItem key={year.id} value={String(year.id)}>
                          {year.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 w-1/2">
                  <Label htmlFor="section_id">
                    Section
                  </Label>
                  <Select
                    onValueChange={(value) => handleSelectChange("section_id", value)}
                    value={String(formData.section_id || '')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a section">
                        {formData.section_id && filteredSections.find(section => String(section.id) === formData.section_id)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSections.length > 0 ? (
                        filteredSections.map((section) => (
                          <SelectItem key={section.id} value={String(section.id)}>
                            {section.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem disabled value="none">
                          No sections available for this program and year level
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="advisor_id">
                  Advisor
                </Label>
                <Select
                  onValueChange={(value) => handleSelectChange("advisor_id", value)}
                  value={String(formData.advisor_id || '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an advisor">
                      {formData.advisor_id && facultyAdvisors.find(advisor => String(advisor.faculty_id) === formData.advisor_id)?.faculty_name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {facultyAdvisors.map((advisor) => (
                      <SelectItem key={advisor.faculty_id} value={String(advisor.faculty_id)}>
                        {advisor.faculty_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Conditionally render Specialization for faculty */}
          {/* {selectedRoles.includes("faculty") && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="specialization">
                Specialization
              </Label>
              <Input
                id="specialization"
                value={formData.specialization}
                onChange={handleChange}
                placeholder="e.g., Software Engineering, Data Science"
              />
            </div>
          )} */}

          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="w-auto">
              Cancel
            </Button>
            <Button variant="green" type="submit" disabled={isLoading} className="w-auto">
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
