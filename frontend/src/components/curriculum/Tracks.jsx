import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogPortal, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SquarePlus, Edit, Trash2, BookText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from '@/config/api';
// --- Define AddTrackDialog Outside ---
const AddTrackDialog = ({ open, onOpenChange, programs, onAddSubmit, setError }) => {
  const [formValues, setFormValues] = useState({
    track_name: "",
    program_id: ""
  });

  // Reset form ONLY when dialog explicitly closes (open becomes false)
  useEffect(() => {
    if (!open) {
      // Use a timeout to ensure state reset happens cleanly after potential error display
      const timer = setTimeout(() => {
        setFormValues({
          track_name: "",
          program_id: ""
        });
      }, 50); 
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!formValues.track_name || !formValues.program_id) {
      // Use the passed setError for client-side validation
      setError({
        show: true,
        message: "Please fill in all fields"
      });
      return;
    }
    // Call the handler passed from the parent
    await onAddSubmit(formValues); 
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Track</DialogTitle>
          <DialogDescription>
            Add a new track to the curriculum.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Track Name</Label>
            <Input
              placeholder="Enter track name"
              value={formValues.track_name}
              onChange={(e) => setFormValues(prev => ({
                ...prev,
                track_name: e.target.value
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <Select
              value={formValues.program_id}
              onValueChange={(value) => setFormValues(prev => ({
                ...prev,
                program_id: value
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id.toString()}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="green" onClick={handleSubmit}>
            Add Track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// --- Define EditDialog Outside ---
const EditDialog = ({ open, onOpenChange, programs, editTrack, onEditSubmit, setError }) => {
  const [formValues, setFormValues] = useState({
    track_name: "",
    program_id: ""
  });

  // Populate form when opened or editTrack changes while open
  useEffect(() => {
    if (open && editTrack) {
      setFormValues({
        track_name: editTrack.track_name,
        program_id: editTrack.program_id.toString()
      });
    }
    // Reset is handled by onOpenChange below
  }, [editTrack, open]);

  const handleSubmit = async () => {
    if (!formValues.track_name || !formValues.program_id) {
      // Use the passed setError for client-side validation
      setError({
        show: true,
        message: "Please fill in all fields"
      });
      return;
    }
    // Call the handler passed from the parent
    await onEditSubmit(formValues);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      // Reset form ONLY when dialog explicitly closes
      if (!isOpen) {
        // Use a timeout to ensure state reset happens cleanly
        const timer = setTimeout(() => {
          setFormValues({ track_name: "", program_id: "" });
        }, 50); 
        return () => clearTimeout(timer);
      }
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Track</DialogTitle>
          <DialogDescription>
            Make changes to the track details below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Track Name</Label>
            <Input
              placeholder="Enter track name"
              value={formValues.track_name}
              onChange={(e) => setFormValues(prev => ({
                ...prev,
                track_name: e.target.value
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Program</Label>
            <Select
              value={formValues.program_id}
              onValueChange={(value) => setFormValues(prev => ({
                ...prev,
                program_id: value
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id.toString()}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="green" onClick={handleSubmit}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Tracks = () => {
  const { user } = useAuth();
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [programs, setPrograms] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newTrack, setNewTrack] = useState({
    track_name: "",
    program_id: ""
  });
  const [error, setError] = useState({ show: false, message: "" });
  const [trackToDelete, setTrackToDelete] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTrack, setEditTrack] = useState(null);
  const [selectedTrackElectives, setSelectedTrackElectives] = useState([]);
  const [isElectivesLoading, setIsElectivesLoading] = useState(false);
  const [showAddElectiveDialog, setShowAddElectiveDialog] = useState(false);
  const [newElective, setNewElective] = useState({
    course_code: "",
    course_title: "",
    track_id: ""
  });
  const [electiveToDelete, setElectiveToDelete] = useState(null);
  const [showDeleteElectiveDialog, setShowDeleteElectiveDialog] = useState(false);
  const [showEditElectiveDialog, setShowEditElectiveDialog] = useState(false);
  const [electiveToEdit, setElectiveToEdit] = useState(null);

  const fetchTracksData = async () => {
    if (!user || !user.id) return;

    try {
      setIsLoading(true);
      
      const programResponse = await fetch(`${API_BASE_URL}/program/read_by_program_chair.php?id=${user.id}`);
      const programData = await programResponse.json();
      
      if (programData.message) {
        console.log("Program chair message:", programData.message);
        setTracks([]);
        return;
      }
      
      setPrograms(programData);
      
      const assignedProgramIds = programData.map(program => program.id);
      
      const tracksResponse = await fetch(`${API_BASE_URL}/tracks/read.php`);
      const tracksData = await tracksResponse.json();
      
      if (tracksData.success) {
        const filteredTracks = assignedProgramIds.length > 0
          ? tracksData.tracks.filter(track => 
              assignedProgramIds.includes(parseInt(track.program_id))
            )
          : [];

        setTracks(filteredTracks);
      } else {
        console.error("Failed to fetch tracks:", tracksData.message);
        setTracks([]);
      }
    } catch (error) {
      console.error("Error fetching tracks:", error);
      setTracks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracksData();
  }, [user]);

  const fetchElectives = async (trackId) => {
    try {
      setIsElectivesLoading(true);
      const response = await fetch(`${API_BASE_URL}/elective_courses/read.php?track_id=${trackId}`);
      const data = await response.json();

      if (data.success) {
        setSelectedTrackElectives(data.electives);
      } else {
        setError({
          show: true,
          message: data.message || "Failed to fetch electives"
        });
      }
    } catch (error) {
      console.error("Error fetching electives:", error);
      setError({
        show: true,
        message: "Error fetching electives. Please try again."
      });
    } finally {
      setIsElectivesLoading(false);
    }
  };

  const handleViewElectives = (track) => {
    setSelectedTrack(track);
    setIsSheetOpen(true);
    fetchElectives(track.id);
  };

  const handleAddTrack = async (formValues) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tracks/create.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formValues)
      });
      const data = await response.json();
      if (data.success) {
        setShowAddDialog(false); // Close only on success
        await fetchTracksData();
      } else {
        setError({ show: true, message: data.message || "Failed to create track" }); // Keep open on error
      }
    } catch (error) {
      setError({ show: true, message: "Error creating track. Please try again." }); // Keep open on error
    }
  };

  const handleDeleteTrack = async (trackId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/tracks/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: trackId
        })
      });

      const data = await response.json();

      setShowDeleteDialog(false);

      if (data.success) {
        await fetchTracksData();
        setSelectedTrack(null);
      } else {
        setError({
          show: true,
          message: data.message || "Failed to delete track"
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setShowDeleteDialog(false);
      setError({
        show: true,
        message: "Error deleting track. Please try again."
      });
    }
  };

  const handleEditTrack = async (formValues) => {
    if (!editTrack) return;
    try {
      const response = await fetch(`${API_BASE_URL}/tracks/update.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTrack.id,
          track_name: formValues.track_name,
          program_id: formValues.program_id
        })
      });
      const data = await response.json();
      if (data.success) {
        setShowEditDialog(false); // Close only on success
        setEditTrack(null);      // Reset edit state only on success
        await fetchTracksData();
      } else {
        setError({ show: true, message: data.message || "Failed to update track" }); // Keep open on error
      }
    } catch (error) {
      console.error('Update error:', error);
      setError({ show: true, message: "Error updating track. Please try again." }); // Keep open on error
    }
  };

  const ErrorDialog = ({ open, onOpenChange, message }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Error</DialogTitle>
          <DialogDescription>
            An error occurred while performing the operation.
          </DialogDescription>
        </DialogHeader>
        <p className="text-destructive">{message}</p>
        <DialogFooter>
          <Button variant="green" onClick={() => onOpenChange(false)}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const DeleteConfirmationDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) setTrackToDelete(null);
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Track</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the track and all its associated electives.
          </DialogDescription>
        </DialogHeader>
        <p>Are you sure you want to delete the track "{trackToDelete?.track_name}"?</p>
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => handleDeleteTrack(trackToDelete.id)}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleAddElective = async (formValues) => {
    try {
      const response = await fetch(`${API_BASE_URL}/elective_courses/create.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_code: formValues.course_code,
          course_title: formValues.course_title,
          track_id: selectedTrack.id
        })
      });

      const data = await response.json();

      setShowAddElectiveDialog(false);

      if (data.success) {
        await fetchElectives(selectedTrack.id);
      } else {
        setError({
          show: true,
          message: data.message || "Failed to create elective course"
        });
      }
    } catch (error) {
      console.error('Creation error:', error);
      setShowAddElectiveDialog(false);
      setError({
        show: true,
        message: "Error creating elective course. Please try again."
      });
    }
  };

  const AddElectiveDialog = ({ open, onOpenChange, onSave, selectedTrack }) => {
    const [formValues, setFormValues] = useState({
      course_code: "",
      course_title: ""
    });

    const handleSubmit = async () => {
      await onSave(formValues);
      setFormValues({ course_code: "", course_title: "" });
    };

    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setFormValues({ course_code: "", course_title: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Elective Course</DialogTitle>
            <DialogDescription>
              Add a new elective course to this track.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course Code</Label>
              <Input
                placeholder="Enter course code"
                value={formValues.course_code}
                onChange={(e) => setFormValues(prev => ({
                  ...prev,
                  course_code: e.target.value.toUpperCase()
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input
                placeholder="Enter course title"
                value={formValues.course_title}
                onChange={(e) => setFormValues(prev => ({
                  ...prev,
                  course_title: e.target.value
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="green" onClick={handleSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const handleDeleteElective = async () => {
    if (!electiveToDelete) return;

    try {
      setShowDeleteElectiveDialog(false);
      
      const response = await fetch(`${API_BASE_URL}/elective_courses/delete.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: electiveToDelete.id
        })
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON response:', text);
        throw new Error('Invalid server response');
      }

      if (data.success) {
        setElectiveToDelete(null);
        await fetchElectives(selectedTrack.id);
      } else {
        setError({
          show: true,
          message: data.message || "Failed to delete elective course"
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError({
        show: true,
        message: "Error deleting elective course. Please try again."
      });
    }
  };

  const DeleteElectiveDialog = ({ open, onOpenChange }) => (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setElectiveToDelete(null);
        }
        onOpenChange(isOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Elective Course</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the elective course.
          </DialogDescription>
        </DialogHeader>
        <p>Are you sure you want to delete the elective course "{electiveToDelete?.course_code} - {electiveToDelete?.course_title}"?</p>
        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={async () => {
              await handleDeleteElective();
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const handleEditElective = async (formValues) => {
    if (!electiveToEdit) return;

    try {
      const response = await fetch(`${API_BASE_URL}/elective_courses/update.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: electiveToEdit.id,
          course_code: formValues.course_code,
          course_title: formValues.course_title
        })
      });

      const data = await response.json();

      setShowEditElectiveDialog(false);
      setElectiveToEdit(null);

      if (data.success) {
        await fetchElectives(selectedTrack.id);
      } else {
        setError({
          show: true,
          message: data.message || "Failed to update elective course"
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      setShowEditElectiveDialog(false);
      setElectiveToEdit(null);
      setError({
        show: true,
        message: "Error updating elective course. Please try again."
      });
    }
  };

  const EditElectiveDialog = ({ open, onOpenChange }) => {
    const [formValues, setFormValues] = useState({
      course_code: "",
      course_title: ""
    });

    useEffect(() => {
      if (electiveToEdit) {
        setFormValues({
          course_code: electiveToEdit.course_code,
          course_title: electiveToEdit.course_title
        });
      }
    }, [electiveToEdit]);

    const handleSubmit = async () => {
      if (!formValues.course_code || !formValues.course_title) {
        setError({
          show: true,
          message: "Please fill in all fields"
        });
        return;
      }
      await handleEditElective(formValues);
    };

    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setFormValues({ course_code: "", course_title: "" });
          setElectiveToEdit(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Elective Course</DialogTitle>
            <DialogDescription>
              Make changes to the elective course details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course Code</Label>
              <Input
                placeholder="Enter course code"
                value={formValues.course_code}
                onChange={(e) => setFormValues(prev => ({
                  ...prev,
                  course_code: e.target.value.toUpperCase()
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input
                placeholder="Enter course title"
                value={formValues.course_title}
                onChange={(e) => setFormValues(prev => ({
                  ...prev,
                  course_title: e.target.value
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="green" onClick={handleSubmit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Card className="flex-shrink-0 h-[calc(100vh-30rem)]">
      <ErrorDialog 
        open={error.show} 
        onOpenChange={(open) => setError(prev => ({ ...prev, show: open }))} 
        message={error.message} 
      />

      <DeleteConfirmationDialog 
        open={showDeleteDialog} 
        onOpenChange={setShowDeleteDialog} 
      />

      <EditDialog 
        open={showEditDialog} 
        onOpenChange={setShowEditDialog} 
        programs={programs}
        editTrack={editTrack}
        onEditSubmit={handleEditTrack}
        setError={setError}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h2 className="text-lg font-semibold text-[#205c1c]">Tracks</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowAddDialog(true)}>
              <SquarePlus className="h-4 w-4 text-[#205c1c]" />
            </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Add new track</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-0">
        <Separator className="mt-2"/>
        <div className="h-[calc(100vh-37rem)]">
          <ScrollArea className="h-full mt-4">
            <div className="px-4 space-y-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <p className="text-sm text-muted-foreground">Loading tracks...</p>
                </div>
              ) : tracks.length > 0 ? (
                tracks.map((track) => (
                  <div
                    key={track.id}
                    className="px-4 py-2.5 cursor-pointer rounded-md transition-colors flex justify-between items-center hover:bg-muted/50"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{track.track_name}</span>
                      <span className="text-sm text-muted-foreground">{track.program_name}</span>
                    </div>
                    <TooltipProvider>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                              className="h-8 w-8 shrink-0 rounded-full"
                              onClick={() => handleViewElectives(track)}
                    >
                              <BookText className="h-4 w-4" />
                    </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View professional electives</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                              className="h-8 w-8 shrink-0 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditTrack(track);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                    </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit track</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                              className="h-8 w-8 shrink-0 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackToDelete(track);
                                setShowDeleteDialog(true);
                              }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/80" />
                    </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete track</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-4">
                  <p className="text-sm text-muted-foreground">No tracks available</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader className="space-y-4">
            <div>
              <SheetTitle className="text-xl font-semibold text-[#205c1c]">
                Professional Electives
              </SheetTitle>
              <SheetDescription className="text-base font-medium text-gray-600">
                {selectedTrack?.track_name}
              </SheetDescription>
            </div>
            <Separator />
          </SheetHeader>
          
          <div className="mt-8 space-y-6">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Elective Courses</h4>
                <p className="text-sm text-gray-600">
                  Manage professional electives for this track
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9"
                onClick={() => setShowAddElectiveDialog(true)}
              >
                <SquarePlus className="h-4 w-4 text-[#205c1c]" />
              </Button>
            </div>
            
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="space-y-4 pr-4">
                {isElectivesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <p className="text-sm text-muted-foreground">Loading electives...</p>
                  </div>
                ) : selectedTrackElectives.length > 0 ? (
                  selectedTrackElectives.map((elective) => (
                    <div
                      key={elective.id}
                      className="flex items-center justify-between py-3 px-4 rounded-md border bg-card hover:bg-accent transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{elective.course_code}</span>
                        <span className="text-sm text-muted-foreground">{elective.course_title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={() => {
                            setElectiveToEdit(elective);
                            setShowEditElectiveDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full"
                          onClick={() => {
                            setElectiveToDelete(elective);
                            setShowDeleteElectiveDialog(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <p className="text-sm text-muted-foreground">No electives available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <AddElectiveDialog 
        open={showAddElectiveDialog} 
        onOpenChange={setShowAddElectiveDialog}
        onSave={handleAddElective}
        selectedTrack={selectedTrack}
      />

      <DeleteElectiveDialog 
        open={showDeleteElectiveDialog} 
        onOpenChange={setShowDeleteElectiveDialog} 
      />

      <EditElectiveDialog 
        open={showEditElectiveDialog} 
        onOpenChange={setShowEditElectiveDialog} 
      />

      <AddTrackDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        programs={programs}
        onAddSubmit={handleAddTrack}
        setError={setError}
      />
    </Card>
  );
};

export default Tracks;