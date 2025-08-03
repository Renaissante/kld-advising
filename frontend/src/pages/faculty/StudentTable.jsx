import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, UserCog, FileText, Mail } from "lucide-react";

// Converted props from TypeScript interface to standard destructuring
export default function StudentTable({ students = [], onAdviseStudent, sectionName, activeTab }) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter students based on search query
  const filteredStudents = students.filter(
    (student) =>
      student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="mb-2">Students in {sectionName}</CardTitle>
            <CardDescription>
              {/* Use filteredStudents.length for accurate count after search */}
              {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} found
              {searchQuery && ` (out of ${students.length} total)`}
              {!searchQuery && students.length !== 1 && " enrolled"}
              {!searchQuery && students.length === 1 && " enrolled"}
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search students by ID or name..." // More specific placeholder
              className="pl-8 w-full h-9" // Match height from AdvisingPage search
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Keep the border div consistent with GradesInputTable structure */}
        <div className="rounded-md border overflow-hidden">
          <Table>
            {/* Added background class to TableHeader */}
            <TableHeader className="bg-muted/50">
              <TableRow>
                {/* Added consistent padding and width */}
                <TableHead className="w-[120px] px-3 py-2">Student ID</TableHead>
                {/* Added consistent padding */}
                <TableHead className="min-w-[150px] px-3 py-2">Name</TableHead>
                {/* Added consistent padding */}
                <TableHead className="px-3 py-2">Status</TableHead>
                {/* Added consistent padding */}
                <TableHead className="px-3 py-2">Advising Status</TableHead>
                {/* Added consistent padding */}
                <TableHead className="px-3 py-2">Units</TableHead>
                {/* Added consistent padding and alignment */}
                <TableHead className="text-right px-3 py-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    {/* Added consistent padding */}
                    <TableCell className="font-medium px-3 py-2">{student.id}</TableCell>
                    {/* Added consistent padding */}
                    <TableCell className="px-3 py-2">{student.name}</TableCell>
                    {/* Added consistent padding */}
                    <TableCell className="px-3 py-2">
                      <Badge
                        variant={
                          student.status === "Regular"
                            ? "default" // Assuming default is green/primary
                            : student.status === "Irregular"
                            ? "secondary" // Assuming secondary is gray/muted
                            : "outline"
                        }
                      >
                        {student.status}
                      </Badge>
                    </TableCell>
                    {/* Added consistent padding */}
                    <TableCell className="px-3 py-2">
                      <Badge
                         variant={
                           student.advising_status === "Done"
                             ? "default" // Or a specific color for Done
                             : "secondary" // Or a specific color for Pending
                         }
                      >
                        {student.advising_status}
                      </Badge>
                    </TableCell>
                    {/* Added consistent padding */}
                    <TableCell className="px-3 py-2">{student.units}</TableCell>
                    {/* REVERTED: Actions Cell back to DropdownMenu */}
                    <TableCell className="text-right px-3 py-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                        {activeTab === "current" && (
                          <DropdownMenuItem
                            onClick={() => {
                              setTimeout(() => {
                                onAdviseStudent(student);
                              }, 0);
                            }}
                          >
                            <UserCog className="mr-2 h-4 w-4" />
                            <span>Advise</span>
                          </DropdownMenuItem>
                        )}


                          <DropdownMenuItem>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>View Records</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            <span>Send Message</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  {/* Added text-muted-foreground for consistency */}
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {searchQuery ? "No students match your search." : "No students found in this section."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}