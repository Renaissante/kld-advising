import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody } from "@/components/ui/table";
import { Edit, Trash2, PlusSquare, Check, ChevronsUpDown, X, Search } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogPortal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Helper function to format prerequisites
const formatPrerequisites = (prerequisites = []) => {
  if (!Array.isArray(prerequisites) || prerequisites.length === 0) {
    return '';
  }

  // Sort by code to make pairing easier
  const sortedPrereqs = [...prerequisites].sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  const formattedCodes = [];
  const processedIds = new Set(); // Keep track of IDs already included in a pair or added individually

  for (let i = 0; i < sortedPrereqs.length; i++) {
    const currentPrereq = sortedPrereqs[i];

    // Skip if already processed
    if (processedIds.has(currentPrereq.id)) {
      continue;
    }

    const currentCode = currentPrereq.code || ''; // Handle potential undefined code
    let pairFound = false;

    // Check if current code ends with 'L' (and is not just 'L')
    if (currentCode.endsWith('L') && currentCode.length > 1) {
      const baseCode = currentCode.slice(0, -1); // Code without 'L'
      // Look for the base code among the prerequisites
      const pair = sortedPrereqs.find(p => p.id !== currentPrereq.id && p.code === baseCode && !processedIds.has(p.id));

      if (pair) {
        formattedCodes.push(`${baseCode}/L`);
        processedIds.add(currentPrereq.id);
        processedIds.add(pair.id); // Mark the pair's ID as processed too
        pairFound = true;
      }
    } else {
      // Current code does NOT end with 'L'. Look for a corresponding code ending with 'L'.
      const labCode = `${currentCode}L`;
      const pair = sortedPrereqs.find(p => p.id !== currentPrereq.id && p.code === labCode && !processedIds.has(p.id));

      if (pair) {
        formattedCodes.push(`${currentCode}/L`);
        processedIds.add(currentPrereq.id);
        processedIds.add(pair.id); // Mark the pair's ID as processed too
        pairFound = true;
      }
    }

    // If no pair was found for the current prerequisite, add its code as is
    if (!pairFound) {
      formattedCodes.push(currentCode);
      processedIds.add(currentPrereq.id); // Mark as processed
    }
  }

  // Sort the final formatted codes alphabetically before joining
  return formattedCodes.sort((a, b) => a.localeCompare(b)).join(', ');
};

export const Curriculum = ({ curriculumName,selectedCurriculum, courses = [], currentCurriculumCourses = [], yearLevels = [], semesters = [], onAddCourse, onDeleteCourse, onSaveCourse }) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  
  // Initial state for new/editing course
  const initialCourseState = {
    code: "",
    title: "",
    lecUnit: "",
    labUnit: "",
    lecHours: "",
    labHours: "",
    prerequisite_ids: [],
    yearLevelId: null,
    semesterId: null
  };
  const [newCourse, setNewCourse] = useState(initialCourseState);

  const [currentYearSemester, setCurrentYearSemester] = useState(null);
  const [prereqPopoverOpen, setPrereqPopoverOpen] = useState(false);
  const [prereqSearchTerm, setPrereqSearchTerm] = useState("");
  const popoverTriggerRef = useRef(null);

  // Ensure arrays are properly initialized
  const safeCourses = Array.isArray(courses) ? courses : [];
  const safeCurrentCourses = Array.isArray(currentCurriculumCourses) ? currentCurriculumCourses : [];
  const safeYearLevels = Array.isArray(yearLevels) ? yearLevels : [];
  const safeSemesters = Array.isArray(semesters) ? semesters : [];

 
  // Prepare course list for the prerequisite dropdown
  // Filter out the course being edited itself
  const prerequisiteOptions = safeCurrentCourses
    .filter(course => !(isEditing && course.id === editingCourseId))
    .map(course => ({
        value: course.id,
        label: `${course.course_code} - ${course.course_title}`,
        code: course.course_code
    }))
    .sort((a, b) => a.label.localeCompare(b.label));


  // Dialog state management
  const handleDialogChange = (dialogType, isOpen) => {
    switch (dialogType) {
      case 'add':
        setShowAddDialog(isOpen);
        if (!isOpen) {
          resetCourseForm();
          setIsEditing(false);
          setEditingCourseId(null);
          setCurrentYearSemester(null);
          setPrereqPopoverOpen(false);
          setPrereqSearchTerm("");
        }
        break;
      case 'validation':
        setShowValidationDialog(isOpen);
        if (!isOpen) {
          setValidationMessage("");
        }
        break;
      case 'delete':
        setShowDeleteDialog(isOpen);
        if (!isOpen) {
          setCourseToDelete(null);
        }
        break;
    }
  };

  const resetCourseForm = () => {
    setNewCourse({
      ...initialCourseState,
      yearLevelId: currentYearSemester?.yearLevel?.id || null,
      semesterId: currentYearSemester?.semester?.id || null
    });
    setPrereqSearchTerm("");
  };

  const showError = (message) => {
    setValidationMessage(message);
    setShowValidationDialog(true);
  };

  const handleNumericInput = (field, value) => {
    // Allow numbers, decimal points, and empty string
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setNewCourse(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleEditCourse = (course) => {
    setIsEditing(true);
    setEditingCourseId(course.id);
    const yearLevel = safeYearLevels.find(yl => String(yl.id) === String(course.year_level_id));
    const semester = safeSemesters.find(sem => String(sem.id) === String(course.semester_id));
    if (yearLevel && semester) {
      setCurrentYearSemester({ yearLevel, semester });
    } else {
      setCurrentYearSemester(null);
    }
    
    // Ensure prerequisites is an array of IDs
    const prereqIds = Array.isArray(course.prerequisites) 
        ? course.prerequisites.map(p => p.id) 
        : [];

    setNewCourse({
      code: course.course_code,
      title: course.course_title,
      lecUnit: course.unit_lec,
      labUnit: course.unit_lab,
      lecHours: course.hour_lec,
      labHours: course.hour_lab,
      prerequisite_ids: prereqIds,
      yearLevelId: course.year_level_id || null,
      semesterId: course.semester_id || null
    });

    setShowAddDialog(true);
  };

  const handleAddCourseClick = (yearLevel, semester) => {
    setCurrentYearSemester({ yearLevel, semester });
    resetCourseForm();
    setIsEditing(false);
    setEditingCourseId(null);
    setShowAddDialog(true);
  };

  const handleSaveCourse = async () => {
    if (!newCourse.code || !newCourse.title) {
      showError("Course Code and Course Title are required.");
      return;
    }
    
    const yearLevelIdToSave = isEditing ? newCourse.yearLevelId : (currentYearSemester?.yearLevel?.id || null);
    const semesterIdToSave = isEditing ? newCourse.semesterId : (currentYearSemester?.semester?.id || null);
 
    if (yearLevelIdToSave === null || semesterIdToSave === null) {
      showError("Year Level and Semester information is missing.");
      return;
    }

    const courseToSave = {
      curriculum_id: selectedCurriculum,
      course_code: newCourse.code,
      course_title: newCourse.title,
      unit_lec: newCourse.lecUnit || "0",
      unit_lab: newCourse.labUnit || "0",
      hour_lec: newCourse.lecHours || "0",
      hour_lab: newCourse.labHours || "0",
      prerequisite_ids: newCourse.prerequisite_ids || [],
      year_level_id: yearLevelIdToSave,
      semester_id: semesterIdToSave
    };

    if (isEditing && editingCourseId) {
      courseToSave.id = editingCourseId;
    }

    console.log("--- Curriculum.jsx: handleSaveCourse ---");
    console.log("Course object being sent up:", courseToSave);

    try {
      await onSaveCourse(courseToSave);
      handleDialogChange('add', false);
    } catch (error) {
      console.error("Error saving course (caught in Curriculum.jsx):", error);
    }
  };

  const handleDeleteCourse = (courseId) => {
    setCourseToDelete(courseId);
    handleDialogChange('delete', true);
  };

  const confirmDeleteCourse = () => {
    if (onDeleteCourse && courseToDelete !== null) {
        onDeleteCourse(courseToDelete);
    }
    handleDialogChange('delete', false);
  };

  // Filter all courses based on the global search term first
  const globallyFilteredCourses = safeCurrentCourses.filter(course => {
    if (!globalSearchTerm) return true; // No search term, include all
    const searchTermLower = globalSearchTerm.toLowerCase();
    const codeMatch = course.course_code?.toLowerCase().includes(searchTermLower);
    const titleMatch = course.course_title?.toLowerCase().includes(searchTermLower);
    return codeMatch || titleMatch;
  });

  // Get courses for a specific semester from the globally filtered list
  const getFilteredCoursesForSemester = (yearLevelId, semesterId) => {
    return globallyFilteredCourses.filter(
      course => String(course.year_level_id) === String(yearLevelId) && String(course.semester_id) === String(semesterId)
    );
  };

  const handlePrerequisiteSelect = (selectedValue) => {
    setNewCourse(prev => {
      const currentPrereqs = prev.prerequisite_ids || [];
      const isSelected = currentPrereqs.includes(selectedValue);
      let updatedPrereqs;
      if (isSelected) {
        updatedPrereqs = currentPrereqs.filter(id => id !== selectedValue);
      } else {
        updatedPrereqs = [...currentPrereqs, selectedValue];
      }
      return { ...prev, prerequisite_ids: updatedPrereqs };
    });
    setPrereqSearchTerm("");
  };

  const getSelectedPrerequisiteCodes = () => {
    return newCourse.prerequisite_ids
      .map(id => prerequisiteOptions.find(opt => opt.value === id)?.code)
      .filter(Boolean)
      .join(', ');
  };

  if (!curriculumName) return null;

  const academicYear = curriculumName.academicYear || "";
  const startYear = academicYear.split('-')[0];
  const endYear = startYear ? parseInt(startYear) + 4 : null;
  const fullYearSpan = startYear && endYear ? `${startYear}-${endYear}` : academicYear;

  const ValidationDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invalid Input</DialogTitle>
          </DialogHeader>
          <p>{validationMessage}</p>
          <DialogFooter>
            <Button variant="green" onClick={() => onOpenChange(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );

  return (
    <>
      <ValidationDialog 
        open={showValidationDialog} 
        onOpenChange={(open) => handleDialogChange('validation', open)} 
      />

      <div className="flex justify-between items-center pr-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1b4b2a]">{curriculumName.name} Curriculum</h2>
          <p className="text-sm text-gray-600">{curriculumName.program} | {fullYearSpan}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {safeYearLevels.map((yearLevel, ylIndex) => (
          <div key={yearLevel.id}>
            {safeSemesters.map((semester, semIndex) => {
              const filteredCourses = getFilteredCoursesForSemester(yearLevel.id, semester.id);
              const isFirstSemesterCard = ylIndex === 0 && semIndex === 0;

              return (
                <Card key={`${yearLevel.id}-${semester.id}`} className="mb-4">
                  <CardHeader className={`bg-[#1b4b2a] text-white py-2 px-4 flex items-center rounded-t-lg ${isFirstSemesterCard ? 'flex-row justify-between space-x-4' : ''}`}>
                    {isFirstSemesterCard ? (
                      <>
                        <h2 className="text-base font-semibold whitespace-nowrap">{yearLevel.name} - {semester.name}</h2>
                        
                        <div className="flex items-center gap-2 flex-grow justify-end">
                          <div className="relative flex-grow max-w-[14rem]">
                            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300 pointer-events-none" />
                            <Input
                              type="search"
                              placeholder="Search course..."
                              value={globalSearchTerm}
                              onChange={(e) => setGlobalSearchTerm(e.target.value)}
                              className="pl-8 h-8 text-white placeholder:text-gray-200 dark:border-gray-200"
                            />
                          </div>
                          
                          <Button 
                            size="sm" 
                            variant="green" 
                            className="border border-white h-8 text-xs whitespace-nowrap"
                            onClick={() => handleAddCourseClick(yearLevel, semester)}
                          >
                            + Add Course
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <h2 className="text-base font-semibold">{yearLevel.name} - {semester.name}</h2>
                        <Button 
                          size="sm" 
                          variant="green" 
                          className="border border-white h-7 text-xs"
                          onClick={() => handleAddCourseClick(yearLevel, semester)}
                        >
                          + Add Course
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <div className="p-4">
                    <Table className="border">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead rowSpan={2} className="align-bottom border-r">Course Code</TableHead>
                          <TableHead rowSpan={2} className="align-bottom border-r">Course Title</TableHead>
                          <TableHead colSpan={2} className="text-center border-b border-r">Course Unit</TableHead>
                          <TableHead colSpan={2} className="text-center border-b border-r">Credit Hours</TableHead>
                          <TableHead rowSpan={2} className="align-bottom border-r">Prerequisite(s)</TableHead>
                          <TableHead rowSpan={2} className="text-right align-bottom">Action</TableHead>
                        </TableRow>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-center w-24 border-r">Lec</TableHead>
                          <TableHead className="text-center w-24 border-r">Lab</TableHead>
                          <TableHead className="text-center w-24 border-r">Lec</TableHead>
                          <TableHead className="text-center w-24 border-r">Lab</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {globallyFilteredCourses.length > 0 && filteredCourses.length === 0 && globalSearchTerm && (
                           <TableRow>
                             <TableCell colSpan={8} className="text-center text-muted-foreground">
                               No courses match your search in this semester.
                             </TableCell>
                           </TableRow>
                        )}
                        {safeCurrentCourses.length > 0 && globallyFilteredCourses.length === 0 && globalSearchTerm && (
                           <TableRow>
                             <TableCell colSpan={8} className="text-center text-muted-foreground">
                               No courses match your search in the entire curriculum.
                             </TableCell>
                           </TableRow>
                        )}
                         {safeCurrentCourses.length === 0 && (
                           <TableRow>
                             <TableCell colSpan={8} className="text-center text-muted-foreground">
                               No courses added yet.
                             </TableCell>
                           </TableRow>
                         )}
                        {filteredCourses.map((course) => (
                            <TableRow key={`${course.id}-${course.course_code}`}>
                              <TableCell className="border-r">{course.course_code}</TableCell>
                              <TableCell className="border-r">{course.course_title}</TableCell>
                              <TableCell className="text-center border-r">{course.unit_lec}</TableCell>
                              <TableCell className="text-center border-r">{course.unit_lab}</TableCell>
                              <TableCell className="text-center border-r">{course.hour_lec}</TableCell>
                              <TableCell className="text-center border-r">{course.hour_lab}</TableCell>
                              <TableCell className="border-r">
                                {formatPrerequisites(course.prerequisites)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    size="icon" 
                                    variant="outline" 
                                    className="p-2 h-8 w-8"
                                    onClick={() => handleEditCourse(course)}
                                  >
                                    <Edit size={16} />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="destructive" 
                                    className="p-2 h-8 w-8"
                                    onClick={() => handleDeleteCourse(course.id)}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                      {filteredCourses.length > 0 && (
                        <tfoot>
                          <TableRow className="font-semibold border-t border-border bg-[#f0f5f0]">
                            <TableCell className="border-r">TOTAL CREDIT HOURS</TableCell>
                            <TableCell className="border-r text-center">
                              {parseFloat(filteredCourses.reduce((sum, course) => 
                                sum + (parseFloat(course.hour_lec) || 0) + (parseFloat(course.hour_lab) || 0), 0
                              ).toFixed(1))}
                            </TableCell>
                            <TableCell className="text-center border-r">
                              {parseFloat(filteredCourses.reduce((sum, course) => sum + (parseFloat(course.unit_lec) || 0), 0).toFixed(1))}
                            </TableCell>
                            <TableCell className="text-center border-r">
                              {parseFloat(filteredCourses.reduce((sum, course) => sum + (parseFloat(course.unit_lab) || 0), 0).toFixed(1))}
                            </TableCell>
                            <TableCell className="text-center border-r">
                              {parseFloat(filteredCourses.reduce((sum, course) => sum + (parseFloat(course.hour_lec) || 0), 0).toFixed(1))}
                            </TableCell>
                            <TableCell className="text-center border-r">
                              {parseFloat(filteredCourses.reduce((sum, course) => sum + (parseFloat(course.hour_lab) || 0), 0).toFixed(1))}
                            </TableCell>
                            <TableCell className="border-r"></TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </tfoot>
                      )}
                    </Table>
                  </div>
                </Card>
              );
            })}
          </div>
        ))}
      </div>

      <Dialog open={showAddDialog} onOpenChange={(open) => handleDialogChange('add', open)}>
        <DialogPortal>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {isEditing 
                  ? 'Edit Course' 
                  : currentYearSemester 
                    ? `Add Course for ${currentYearSemester.yearLevel.name} - ${currentYearSemester.semester.name}`
                    : 'Add Course'
                }
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Course Code<span className="text-destructive">*</span></Label>
                  <Input
                    id="code"
                    value={newCourse.code}
                    onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                    placeholder="e.g., CCIS1101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Course Title<span className="text-destructive">*</span></Label>
                  <Input
                    id="title"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    placeholder="e.g., Introduction to Computing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Course Unit</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="lecUnit" className="text-sm font-normal">Lec</Label>
                      <Input
                        id="lecUnit"
                        type="number" min="0" step="0.1"
                        value={newCourse.lecUnit}
                        onChange={(e) => handleNumericInput('lecUnit', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="labUnit" className="text-sm font-normal">Lab</Label>
                      <Input
                        id="labUnit"
                        type="number" min="0" step="0.1"
                        value={newCourse.labUnit}
                        onChange={(e) => handleNumericInput('labUnit', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Credit Hours</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="lecHours" className="text-sm font-normal">Lec</Label>
                      <Input
                        id="lecHours"
                        type="number" min="0" step="0.1"
                        value={newCourse.lecHours}
                        onChange={(e) => handleNumericInput('lecHours', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="labHours" className="text-sm font-normal">Lab</Label>
                      <Input
                        id="labHours"
                        type="number" min="0" step="0.1"
                        value={newCourse.labHours}
                        onChange={(e) => handleNumericInput('labHours', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prerequisite">Prerequisite(s) (Optional)</Label>
                <Popover open={prereqPopoverOpen} onOpenChange={setPrereqPopoverOpen}>
                  <PopoverTrigger asChild ref={popoverTriggerRef}>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={prereqPopoverOpen}
                      className="w-full justify-between font-normal h-auto min-h-10"
                    >
                      <div className="flex-1 overflow-hidden mr-2">
                        <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                          {newCourse.prerequisite_ids.length === 0 && <span className="text-muted-foreground">Select prerequisite(s)</span>}
                          {newCourse.prerequisite_ids.map(id => {
                            const option = prerequisiteOptions.find(opt => opt.value === id);
                            return option ? (
                              <Badge key={id} variant="secondary" className="mr-1 flex-shrink-0">
                                {option.code}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                     className="p-0" 
                     style={{ width: popoverTriggerRef.current?.offsetWidth ? `${popoverTriggerRef.current.offsetWidth}px` : 'auto' }}
                     align="start"
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                         placeholder="Search prerequisite..."
                         value={prereqSearchTerm}
                         onValueChange={setPrereqSearchTerm}
                       />
                      <CommandList>
                        <ScrollArea className="h-[200px]">
                           <CommandEmpty>No course found.</CommandEmpty>
                           <CommandItem
                              key="clear-all"
                              value="clear-all"
                              onSelect={() => {
                                setNewCourse({ ...newCourse, prerequisite_ids: [] });
                              }}
                           >
                             <X className="mr-2 h-4 w-4 text-muted-foreground" />
                             Clear all selections
                           </CommandItem>

                           {prerequisiteOptions
                            .filter(option => option.label.toLowerCase().includes(prereqSearchTerm.toLowerCase()))
                            .map((option) => {
                              const isSelected = newCourse.prerequisite_ids.includes(option.value);
                              return (
                                <CommandItem
                                  key={option.value}
                                  value={option.label}
                                  onSelect={() => handlePrerequisiteSelect(option.value)}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      isSelected ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {option.label}
                                </CommandItem>
                              );
                           })}
                        </ScrollArea>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleDialogChange('add', false)}>Cancel</Button>
              <Button variant="green" onClick={handleSaveCourse}>
                {isEditing ? 'Update Course' : 'Save Course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => handleDialogChange('delete', open)}>
        <DialogPortal>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
            </DialogHeader>
            <p>Are you sure you want to delete this course?</p>
             <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleDialogChange('delete', false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDeleteCourse}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}; 