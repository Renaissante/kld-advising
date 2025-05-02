import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, Calendar, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SectionCarousel({
  allSections,
  selectedSectionId,
  onSelectSection,
  activeTab,
  activeAcademicYear,
  activeSemester,
  selectedHistoricalAy,
  selectedHistoricalSem,
  onHistoricalAyChange,
  onHistoricalSemChange,
  academicYears,
  semesters,
  searchQuery
}) {
  const filteredSections = useMemo(() => {
    let sectionsToDisplay = [];
    if (!allSections) return [];

    const activeAyId = activeAcademicYear?.id;
    const activeSemId = activeSemester?.id;

    if (activeTab === "current") {
      if (activeAyId && activeSemId) {
        sectionsToDisplay = allSections.filter(section =>
          section.academic_year_id === activeAyId &&
          section.semester_id === activeSemId
        );
      } else {
        sectionsToDisplay = [];
      }
    } else {
      if (selectedHistoricalAy && selectedHistoricalSem) {
        sectionsToDisplay = allSections.filter(section =>
          section.academic_year_id === selectedHistoricalAy &&
          section.semester_id === selectedHistoricalSem
        );
      } else {
        if (activeAyId && activeSemId) {
          const previousAySections = allSections.filter(section =>
            section.academic_year_id < activeAyId
          );
          const currentAyPreviousSemSections = allSections.filter(section =>
            section.academic_year_id === activeAyId &&
            section.semester_id < activeSemId
          );
          sectionsToDisplay = [...previousAySections, ...currentAyPreviousSemSections];
        } else {
          sectionsToDisplay = [];
        }
      }
    }

    return sectionsToDisplay.filter((section) =>
      section.name.toLowerCase().includes(searchQuery?.toLowerCase() || '') ||
      (section.program && section.program.toLowerCase().includes(searchQuery?.toLowerCase() || ''))
    );
  }, [allSections, activeTab, activeAcademicYear, activeSemester, selectedHistoricalAy, selectedHistoricalSem, searchQuery]);

  const handleInternalHistoricalSemChange = (semId) => {
    const numericSemId = parseInt(semId);
    if (selectedHistoricalAy === activeAcademicYear?.id && numericSemId === activeSemester?.id) {
      toast.info("Current semester sections are shown in the 'Current Semester' tab.");
      return;
    }
    onHistoricalSemChange(numericSemId);
  };

  const showCarousel = filteredSections && filteredSections.length > 0;

  const getTitle = () => {
    return activeTab === 'current' ? "Current Semester Sections" : "Previous Semester Sections";
  };

  const getDescription = () => {
    if (activeTab === 'current') {
      return `Showing sections for A.Y. ${activeAcademicYear?.year || 'N/A'} ${activeSemester?.name || 'N/A'}. Select a section.`;
    } else {
      return "Select an Academic Year and Semester to view past sections.";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{getTitle()}</CardTitle>
        <CardDescription>{getDescription()}</CardDescription>
        {activeTab === 'previous' && (
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Select value={selectedHistoricalAy ? String(selectedHistoricalAy) : ""} onValueChange={onHistoricalAyChange}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue placeholder="Select Academic Year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears
                  .filter(ay => {
                    if (!activeAcademicYear || !activeSemester) return true;
                    return allSections.some(sec =>
                        sec.academic_year_id < activeAcademicYear.id ||
                        (sec.academic_year_id === activeAcademicYear.id && sec.semester_id < activeSemester.id)
                    );
                  })
                  .map(ay => (
                    <SelectItem key={ay.id} value={String(ay.id)}>{ay.year}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={selectedHistoricalSem ? String(selectedHistoricalSem) : ""} onValueChange={handleInternalHistoricalSemChange} disabled={!selectedHistoricalAy}>
              <SelectTrigger className="w-full sm:w-[220px] h-9">
                <SelectValue placeholder={!selectedHistoricalAy ? "Select AY first" : "Select Semester"} />
              </SelectTrigger>
              <SelectContent>
                {semesters
                  .filter(sem => !(selectedHistoricalAy === activeAcademicYear?.id && sem.id === activeSemester?.id))
                  .filter(sem => allSections.some(sec => sec.academic_year_id === selectedHistoricalAy && sec.semester_id === sem.id))
                  .map(sem => (
                    <SelectItem key={sem.id} value={String(sem.id)}>{sem.name}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {showCarousel ? (
          <Carousel className="w-full relative">
            <CarouselContent className="-ml-4">
              {filteredSections.map((section, index) => {
                const colorIndex = index % 5;
                let bgColorClass;

                switch(colorIndex) {
                  case 0:
                    bgColorClass = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
                    break;
                  case 1:
                    bgColorClass = "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600";
                    break;
                  case 2:
                    bgColorClass = "bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600";
                    break;
                  case 3:
                    bgColorClass = "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600";
                    break;
                  case 4:
                    bgColorClass = "bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600";
                    break;
                  default:
                    bgColorClass = "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600";
                }

                return (
                  <CarouselItem key={section.id} className="pl-4 basis-full md:basis-1/2 lg:basis-1/3">
                    <div className="p-1">
                      <Card
                        className={`cursor-pointer border-2 h-full flex flex-col transition-colors ${bgColorClass} ${
                          selectedSectionId === section.id ? 'border-primary' : ''
                        }`}
                        onClick={() => onSelectSection(section)}
                      >
                        <CardHeader className="pb-2 flex flex-row items-center justify-between">
                          <CardTitle className="text-lg">{section.name}</CardTitle>
                          <Badge variant="">{section.semester}</Badge>
                        </CardHeader>
                        <div className="flex items-center px-6 pb-4 text-sm text-muted-foreground">
                          <span>{section.program}</span>
                        </div>
                        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <BookOpen className="mr-2 h-4 w-4 text-gray-700 dark:text-gray-300" />
                            <span>{section.subjects || 0} Course{section.subjects !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="flex items-center">
                            <Users className="mr-2 h-4 w-4 text-gray-700 dark:text-gray-300" />
                            <span>{section.student_count || 0} Student{section.student_count !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="mr-2 h-4 w-4 text-gray-700 dark:text-gray-300" />
                            <span>{section.year_level}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="top-1/2 -translate-y-1/2" />
            <CarouselNext className="top-1/2 -translate-y-1/2" />
          </Carousel>
        ) : (
          <div className="flex justify-center items-center p-8 text-center">
            <p className="text-muted-foreground">
              {activeTab === 'current'
                ? 'No sections found for the current semester'
                : (selectedHistoricalAy && selectedHistoricalSem)
                    ? `No sections found for the selected academic year and semester`
                    : 'No sections found for previous semesters. Select an A.Y. and Semester above.'
              }
              {searchQuery && ' matching your search'}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}