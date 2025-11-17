import { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '@/config/api';
const ActiveContext = createContext();

export const ActiveProvider = ({ children }) => {
  const [activeAcademicYear, setActiveAcademicYear] = useState(null);
  const [activeSemester, setActiveSemester] = useState(null);
  const [isAdvisingActive, setIsAdvisingActive] = useState(false); // New state for advising status
  const [loading, setLoading] = useState(true);

  // Fetch active academic year and semester
  const fetchActiveData = async () => {
    try {
      setLoading(true);
      
      // Fetch academic years
      const academicYearResponse = await fetch(`${API_BASE_URL}/academic_year/read.php`);
      const academicYears = await academicYearResponse.json();
      
      // Find current academic year
      const activeYear = academicYears.find(year => year.is_current === true);
      setActiveAcademicYear(activeYear || null);

      // Fetch semesters
      const semesterResponse = await fetch(`${API_BASE_URL}/semester/read.php`);
      const semesters = await semesterResponse.json();
      
      // Find current semester
      const activeSem = semesters.find(sem => sem.is_current === true);
      setActiveSemester(activeSem || null);

      // Fetch advising period status only if activeYear and activeSem are found
      if (activeYear && activeSem) {
        const advisingPeriodResponse = await fetch(`${API_BASE_URL}/advising_period/read_single.php?academic_year_id=${activeYear.id}&semester_id=${activeSem.id}`);
        if (advisingPeriodResponse.ok) {
          const advisingPeriodData = await advisingPeriodResponse.json();
          setIsAdvisingActive(advisingPeriodData.status === 'active');
        } else {
          // If no advising period found, it's inactive
          setIsAdvisingActive(false);
        }
      } else {
        setIsAdvisingActive(false);
      }
    } catch (error) {
      console.error('Error fetching active data:', error);
      setIsAdvisingActive(false); // Default to inactive on error
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchActiveData();
  }, []);

  // Function to update active academic year
  const updateActiveAcademicYear = (newYear) => {
    setActiveAcademicYear(newYear);
  };

  // Function to update active semester
  const updateActiveSemester = (newSemester) => {
    setActiveSemester(newSemester);
  };

  // Function to refresh active data
  const refreshActiveData = () => {
    fetchActiveData();
  };

  const refreshAdvisingStatus = async () => {
    if (activeAcademicYear && activeSemester) {
      try {
        const advisingPeriodResponse = await fetch(`${API_BASE_URL}/advising_period/read_single.php?academic_year_id=${activeAcademicYear.id}&semester_id=${activeSemester.id}`);
        if (advisingPeriodResponse.ok) {
          const advisingPeriodData = await advisingPeriodResponse.json();
          setIsAdvisingActive(advisingPeriodData.status === 'active');
        } else {
          setIsAdvisingActive(false);
        }
      } catch (error) {
        console.error('Error refreshing advising status:', error);
        setIsAdvisingActive(false);
      }
    }
  };

  const value = {
    activeAcademicYear,
    activeSemester,
    loading,
    isAdvisingActive, // Expose isAdvisingActive
    updateActiveAcademicYear,
    updateActiveSemester,
    refreshActiveData,
    refreshAdvisingStatus // Expose refreshAdvisingStatus
  };

  return (
    <ActiveContext.Provider value={value}>
      {children}
    </ActiveContext.Provider>
  );
};

export const useActive = () => {
  const context = useContext(ActiveContext);
  if (!context) {
    throw new Error('useActive must be used within an ActiveProvider');
  }
  return context;
}; 