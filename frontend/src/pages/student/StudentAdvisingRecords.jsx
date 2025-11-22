import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, FileText, Download, Eye, X } from "lucide-react"
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/App-sidebar';
import Header from '@/components/layout/Header';
import StudentAdvisingForms from './StudentAdvisingForms';
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from '@/hooks/useAuth';
import { API_BASE_URL } from '@/config/api';
import { Skeleton } from "@/components/ui/skeleton"; 



export default function StudentAdvisingRecords() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [advisingPeriods, setAdvisingPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAdvisingPeriods = async () => {
      if (!user || !user.student_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/student/read_distinct_advising_periods.php?student_id=${user.student_id}`);
        
        // Add console.log for the student_id being used in the API call
        console.log("Fetching advising periods for student_id:", user.student_id);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setAdvisingPeriods(data);
        console.log("Fetched advising periods:", data); // Add console.log here
      } catch (error) {
        console.error("Error fetching advising periods:", error);
        setError("Failed to load advising records.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdvisingPeriods();
  }, [user]);

  const handleViewRecord = (academicYearName, semesterName) => {
    setSelectedAcademicYear(academicYearName);
    setSelectedSemester(semesterName);
    setShowForm(true);
  };

  const handleDownload = async (record) => {
    if (!user?.student_id) return;
    const params = new URLSearchParams({
      student_id: user.student_id,
      academic_year: record.academic_year_name,
      semester: record.semester_name,
      format: 'pdf',
    });
    const url = `${API_BASE_URL}/student/export_advising_form.php?${params.toString()}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to download form.');
      }
      const blob = await response.blob();
      // Try to get filename from headers
      let filename = 'advising_form.pdf';
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match && match[1]) {
          filename = match[1];
        }
      }
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert('Error downloading form: ' + error.message);
    }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <main className="w-full">
          <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-6 w-1/2 mb-4" />
            <Skeleton className="h-4 w-1/3 mb-8" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </main>
      </SidebarProvider>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error: {error}</div>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
    
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="container mx-auto p-4 md:p-6 mt-4">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#1b4b2a]">Academic Advising Records</h1>
            <p className="text-muted-foreground ">
              Browse and access your advising forms.
            </p>
          </div>

          {/* Records Grid */}
          {advisingPeriods.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {advisingPeriods.map((record) => (
                <Card key={`${record.academic_year_id}-${record.semester_id}`} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">Advising Form</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4" />
                          {record.academic_year_name} • {record.semester_name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Advisor</p>
                        <p className="font-medium">{record.advisor_name || "N/A"}</p>
                      </div>

                      <div className="text-sm">
                        <p className="text-muted-foreground mb-1">Submission</p>
                        <p className="font-medium">{record.latest_advising_date ? new Date(record.latest_advising_date).toLocaleDateString() : "N/A"}</p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1 bg-transparent" onClick={() => handleViewRecord(record.academic_year_name, record.semester_name)}>
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(record)}>
                          <Download className="h-4 w-4" />
                        </Button>
                </div>
              </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex justify-center items-center p-8 border rounded-lg text-muted-foreground mt-6">
              <p>No advising records found.</p>
            </div>
          )}
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-[90vw] md:max-w-screen-lg max-h-[90vh] overflow-y-auto" showCloseButton={false}>
            <DialogHeader className="sticky top-0 bg-background pb-2 z-10 flex flex-row items-start justify-between">
              <div>
                <DialogTitle className="text-lg md:text-xl">Advising Form</DialogTitle>
                <DialogDescription className="text-sm md:text-base mt-1">
                  {selectedAcademicYear} {selectedSemester}
                </DialogDescription>
              </div>
              <DialogClose className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
            </DialogHeader>
            <StudentAdvisingForms academicYear={selectedAcademicYear} semester={selectedSemester} />
          </DialogContent>
        </Dialog>
      </main>
    </SidebarProvider>
  )
}