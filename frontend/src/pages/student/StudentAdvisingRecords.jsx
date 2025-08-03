import React, { useState, useEffect } from 'react';
import { Table, TableHead, TableRow, TableHeader, TableCell, TableBody, TableFooter } from "@/components/ui/table";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";


import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/App-sidebar';
import Header from '@/components/layout/Header';
import { Skeleton } from "@/components/ui/skeleton"; 

const StudentAdvisingRecords = () => {
  // Dummy data for advising records - replace with actual fetched data
  const [advisingRecords, setAdvisingRecords] = useState([
    {
      id: 1,
      courseCode: "CS101",
      courseTitle: "Introduction to CS",
      grade: "1.75",
      prerequisite: "PCIS101",
      courseCodeAndTitle: "CS101 - Intro to Computing",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 2,
      courseCode: "MATH201",
      courseTitle: "Calculus I",
      grade: "2.00",
      prerequisite: "MATH100",
      courseCodeAndTitle: "MATH201 - Calculus I",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 3,
      courseCode: "PHY101",
      courseTitle: "Physics I",
      grade: "1.50",
      prerequisite: "MATH101",
      courseCodeAndTitle: "PHY101 - General Physics",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 4,
      courseCode: "ENG101",
      courseTitle: "English Comp.",
      grade: "1.25",
      prerequisite: "",
      courseCodeAndTitle: "ENG101 - English Composition",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 5,
      courseCode: "FIL101",
      courseTitle: "Filipino",
      grade: "1.00",
      prerequisite: "",
      courseCodeAndTitle: "FIL101 - Komunikasyon",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 6,
      courseCode: "PE1",
      courseTitle: "Physical Ed. 1",
      grade: "1.00",
      prerequisite: "",
      courseCodeAndTitle: "PE1 - Physical Education 1",
      units: "2",
      adviserSignature: ""
    },
    {
      id: 7,
      courseCode: "NSTP1",
      courseTitle: "NSTP 1",
      grade: "1.00",
      prerequisite: "",
      courseCodeAndTitle: "NSTP1 - National Service",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 8,
      courseCode: "NSTP1",
      courseTitle: "NSTP 1",
      grade: "1.00",
      prerequisite: "",
      courseCodeAndTitle: "NSTP1 - National Service",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 9,
      courseCode: "NSTP1",
      courseTitle: "NSTP 1",
      grade: "1.00",
      prerequisite: "",
      courseCodeAndTitle: "NSTP1 - National Service",
      units: "3",
      adviserSignature: ""
    },
    {
      id: 10,
      courseCode: "NSTP1",
      courseTitle: "NSTP 1",
      grade: "1.00",
      prerequisite: "",
      courseCodeAndTitle: "NSTP1 - National Service",
      units: "3",
      adviserSignature: ""
    },
  ]);


  return (
    <SidebarProvider>
      <AppSidebar />
    
      <main className="w-full">
        <Header showSidebarTrigger={true} showNavLinks={false} showAuthButtons={false} />

        <div className="p-2"> {/* Reduced padding */}
          <div className="max-w-4xl mx-auto"> {/* Reduced max-width */}
            <div className="border rounded-md p-2 shadow-sm"> {/* Reduced padding and shadow */}
              <div className="mb-2"> {/* Reduced margin-bottom */}
              
                <Table className="border">
                  <TableHeader>
                    
                    <TableRow>   
                      <TableHead colSpan={4} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Name : ESPIRITU, RANIEL VILLAFUERTE</TableHead>
                      <TableHead colSpan={3} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Student No : KLD-22-000291</TableHead>            
                    </TableRow>
                    
                    <TableRow>   
                      <TableHead colSpan={2} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Institute : IMACS</TableHead>
                      <TableHead colSpan={2} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Program/Year/Section : BSIS 301</TableHead>
                      <TableHead colSpan={3} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">Status :</TableHead>            
                    </TableRow>
                    
                    <TableRow>
                      <TableHead colSpan={4} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">LAST ENROLLMENT : 2nd Term, AY 2024-2025</TableHead>
                      <TableHead colSpan={3} className="text-left border-b border-r px-2 py-1 text-xs font-normal h-6">CURRENT ENROLLMENT : 1st Term, AY 2025-2026</TableHead>
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
                    {advisingRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-left border-r px-2 py-1 text-xs">{record.courseCode}</TableCell>
                        <TableCell className="text-left border-r px-2 py-1 text-xs">{record.courseTitle}</TableCell>
                        <TableCell className="text-center border-r px-2 py-1 text-xs">{record.grade}</TableCell>
                        <TableCell className="text-left border-r px-2 py-1 text-xs">{record.prerequisite}</TableCell>
                        <TableCell className="text-left border-r px-2 py-1 text-xs">{record.courseCodeAndTitle}</TableCell>
                        <TableCell className="text-center border-r px-2 py-1 text-xs">{record.units}</TableCell>
                        <TableCell className="text-center px-2 py-1 text-xs">{record.adviserSignature}</TableCell>
                      </TableRow>
                    ))}
                      <TableRow>
                          <TableCell colSpan={4} className="w-[60%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Failed course/s</TableCell>
                          <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs"></TableCell>
                          <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs"></TableCell> 
                          <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs"></TableCell>
                      </TableRow>

                      <TableRow>
                      <TableCell className="w-[12.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Course Code</TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Course Title</TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Term</TableCell>
                      <TableCell className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500">AY</TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="w-[12.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6"></TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell className="w-[12.5%] text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6"></TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[12.5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[25%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[5%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                      <TableCell className="w-[10%] text-center border-b border-r px-2 py-1 text-xs font-medium text-gray-500"></TableCell>
                    </TableRow>

                  </TableBody>

                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6">Total number of units earned : 21 Units</TableCell>
                      <TableCell colSpan={4} className="text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Total number of units to be enrolled : 16 Units</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={3} className="text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500 h-6">Student's Signature : </TableCell>
                      <TableCell colSpan={4} className="text-left border-b border-r px-2 py-1 text-xs font-medium text-gray-500">Adviser's Printed Name : RANDOLPH M. BALLERAS</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}

export default StudentAdvisingRecords