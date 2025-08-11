// frontend/src/pages/ProjectsPage.jsx
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMenu, FiSearch, FiMap, FiBell, FiMoreVertical, FiFolder, FiGrid, FiList, FiPlus, FiEdit, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../apis/config';
import AuthContext from '../contexts/AuthContext';
import CreateProjectModal from '../components/CreateProjectModal';
import ActionModal from '../components/ActionModal';
import Sidebar from '../components/Sidebar';
import '../styles/ProjectsPage.css';

// ProjectCard handles displaying a project and emitting events to open the action modal
const ProjectCard = ({ project, isExample, onOpenModal, viewMode }) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const optionsRef = useRef(null);
  const navigate = useNavigate();

  // Close the options menu when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setIsOptionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (actionType, event) => {
    event.stopPropagation(); // Stop click from bubbling to the card's main click handler
    onOpenModal(actionType, project);
    setIsOptionsOpen(false);
  };

  const handleCardClick = () => {
    if (isExample) {
      toast.info("Example projects do not have a detail page.");
      return;
    }
    navigate(`/project/${project._id}`);
  };

  return (
    <div className={`project-card ${viewMode} ${isOptionsOpen ? 'active' : ''}`} onClick={handleCardClick}>
      <div className="card-thumbnail">
        <img src={project.thumbnail} alt={project.name} />
        {isExample && <span className="example-tag">Example</span>}
      </div>
      <div className="card-info">
        <div className="card-main-info">
          <h3 className="card-title">{project.name}</h3>
          <p className="card-date">{project.date || new Date(project.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="card-footer">
          <div className="card-stats"></div>
          <div className="options-container" ref={optionsRef} onClick={(e) => e.stopPropagation()}>
            {!isExample && (
              <button className="more-options-btn" onClick={() => setIsOptionsOpen(!isOptionsOpen)}>
                <FiMoreVertical />
              </button>
            )}
            {isOptionsOpen && (
              <div className="options-menu">
                <button onClick={(e) => handleAction('rename', e)}><FiEdit /> Rename</button>
                <button onClick={(e) => handleAction('upload', e)}><FiUploadCloud /> Upload Image</button>
                <button className="delete" onClick={(e) => handleAction('delete', e)}><FiTrash2 /> Delete Project</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


// Main Page Component
const ProjectsPage = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    const [actionModalState, setActionModalState] = useState({
        isOpen: false,
        actionType: null, // 'rename', 'delete', 'upload'
        project: null
    });

    const [activeTab, setActiveTab] = useState('recents');
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const { logout } = useContext(AuthContext);

    // Static example projects
    const defaultProjects = [
        { _id: 'default1', name: 'Agriculture Example', thumbnail: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=1974&auto=format&fit=crop', date: 'Track determination sample' },
        { _id: 'default3', name: 'Project Progress Example', thumbnail: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop', date: 'Track progress over time' },
    ];

    // Fetch user's projects on component mount
    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            try {
                const response = await api.get('/projects');
                setProjects(response.data);
            } catch (error) { 
                toast.error("Failed to fetch projects."); 
            } finally { 
                setLoading(false); 
            }
        };
        fetchProjects();
    }, []);

    const openActionModal = (actionType, project) => {
        setActionModalState({ isOpen: true, actionType, project });
    };

    const closeActionModal = () => {
        setActionModalState({ isOpen: false, actionType: null, project: null });
    };
    
    // --- CRUD HANDLERS ---

    const handleCreateProject = async (projectData) => {
        // projectData is an object: { name, latitude, longitude }
        try {
            const response = await api.post('/projects', projectData);
            setProjects([response.data, ...projects]);
            toast.success(`Project "${projectData.name}" created successfully!`);
        } catch (error) { 
            const errorMsg = error.response?.data?.msg || "Failed to create project.";
            toast.error(errorMsg);
        }
    };

    const handleDeleteProject = async (id) => {
        try {
            await api.delete(`/projects/${id}`);
            setProjects(projects.filter(p => p._id !== id));
            toast.info("Project deleted.");
        } catch (error) { 
            toast.error("Failed to delete project."); 
        } finally { 
            closeActionModal(); 
        }
    };

    const handleRenameProject = async (id, newName) => {
        try {
            const response = await api.put(`/projects/${id}`, { name: newName });
            setProjects(projects.map(p => p._id === id ? response.data : p));
            toast.success("Project renamed.");
        } catch (error) { 
            toast.error("Failed to rename project."); 
        } finally { 
            closeActionModal(); 
        }
    };

    const handleUploadThumbnail = async (id, base64Image) => {
        try {
            const response = await api.put(`/projects/${id}`, { thumbnail: base64Image });
            setProjects(projects.map(p => p._id === id ? response.data : p));
            toast.success("Thumbnail updated!");
        } catch (error) { 
            toast.error("Failed to upload thumbnail."); 
        } finally { 
            closeActionModal(); 
        }
    };

    const handleModalConfirm = (id, value) => {
        const { actionType } = actionModalState;
        if (actionType === 'delete') handleDeleteProject(id);
        else if (actionType === 'rename') handleRenameProject(id, value);
        else if (actionType === 'upload') handleUploadThumbnail(id, value);
    };

    const displayedProjects = (activeTab === 'recents' ? [...defaultProjects, ...projects] : projects)
        .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="projects-page-container">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            
            <CreateProjectModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                onCreate={handleCreateProject} 
            />
            
            <ActionModal 
                isOpen={actionModalState.isOpen}
                onClose={closeActionModal}
                actionType={actionModalState.actionType}
                project={actionModalState.project}
                onConfirm={handleModalConfirm}
            />

            <header className="projects-header">
                <div className="header-left">
                    <button className="icon-btn" onClick={() => setIsSidebarOpen(true)}><FiMenu /></button>
                    <h2>Projects</h2>
                </div>
                <div className="header-center">
                    <div className="search-bar">
                        <FiSearch />
                        <input type="text" placeholder="Search folders and projects" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div className="header-right">
                    <button className="icon-btn map-btn"><FiMap /> Map</button>
                    <button className="icon-btn"><FiBell /></button>
                </div>
            </header>

            <main className="projects-main-content">
                <nav className="projects-sub-nav">
                    <div className="tabs">
                        <button className={`tab-btn ${activeTab === 'recents' ? 'active' : ''}`} onClick={() => setActiveTab('recents')}>Recents</button>
                        <button className={`tab-btn ${activeTab === 'myProjects' ? 'active' : ''}`} onClick={() => setActiveTab('myProjects')}>My projects</button>
                    </div>
                    <div className="actions">
                        <button className="action-btn new-folder-btn"><FiFolder /> New folder</button>
                        <button className="action-btn new-project-btn" onClick={() => setIsCreateModalOpen(true)}><FiPlus /> New project</button>
                        <div className="view-toggle">
                            <button className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><FiGrid /></button>
                            <button className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><FiList /></button>
                        </div>
                    </div>
                </nav>

                {loading ? (
                    <p>Loading projects...</p>
                ) : (
                    <div className={`projects-grid ${viewMode}`}>
                        {displayedProjects.length > 0 ? displayedProjects.map(project => (
                            <ProjectCard 
                                key={project._id} 
                                project={project}
                                isExample={project._id.startsWith('default')} 
                                onOpenModal={openActionModal}
                                viewMode={viewMode}
                            />
                        )) : <p>No projects found. Click "New project" to get started!</p>}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ProjectsPage;