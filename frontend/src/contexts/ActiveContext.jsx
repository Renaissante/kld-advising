import { createContext, useContext, useState, useEffect } from 'react';

const ActiveContext = createContext();

export const ActiveProvider = ({ children }) => {
  const [activeAcademicYear, setActiveAcademicYear] = useState(null);
  const [activeSemester, setActiveSemester] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch active academic year and semester
  const fetchActiveData = async () => {
    try {
      setLoading(true);
      
      // Fetch academic years
      const academicYearResponse = await fetch('http://localhost/kld-advising/backend/api/academic_year/read.php');
      const academicYears = await academicYearResponse.json();
      
      // Find active academic year
      const activeYear = academicYears.find(year => year.status === 'Active');
      setActiveAcademicYear(activeYear || null);

      // Fetch semesters
      const semesterResponse = await fetch('http://localhost/kld-advising/backend/api/semester/read.php');
      const semesters = await semesterResponse.json();
      
      // Find active semester
      const activeSem = semesters.find(sem => sem.status === 'Active');
      setActiveSemester(activeSem || null);
    } catch (error) {
      console.error('Error fetching active data:', error);
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

  const value = {
    activeAcademicYear,
    activeSemester,
    loading,
    updateActiveAcademicYear,
    updateActiveSemester,
    refreshActiveData
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