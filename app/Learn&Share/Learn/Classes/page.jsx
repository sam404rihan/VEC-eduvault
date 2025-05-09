"use client";
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';   
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, arrayUnion } from 'firebase/firestore';
import {firebaseApp} from '../../../../firebaseConfig';
import Link from 'next/link';
import { motion } from 'framer-motion';

const ClassesEntry = () => {
    const router = useRouter();
    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);

    const [user, setUser] = useState(null);
    const [userType, setUserType] = useState(null);
    const [activeSection, setActiveSection] = useState(1);
    const [formData, setFormData] = useState({
        className: '',
        standard: '',
        classType: '',
        classDate: '',
        classTime: '',
        imageUrl: '',
        description: '',
        classLink: '',
        minimumRequirements: [],
        whatYouWillLearn: [],
        isPremium: false,
    });
    const [submitted, setSubmitted] = useState(false);
    const [cloudinaryLoaded, setCloudinaryLoaded] = useState(false);
    const [minRequirement, setMinRequirement] = useState('');
    const [learningPoint, setLearningPoint] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [previewMode, setPreviewMode] = useState(false);

    // Color theme
    const colors = {
        primary: "from-purple-600 to-indigo-600",
        secondary: "from-pink-500 to-rose-500",
        accent: "bg-amber-400",
        background: "bg-gradient-to-br from-slate-50 to-slate-100"
    };

    useEffect(() => {
        if (!window.cloudinary) {
            const script = document.createElement("script");
            script.src = "https://upload-widget.cloudinary.com/global/all.js";
            script.async = true;
            script.onload = () => setCloudinaryLoaded(true);
            document.body.appendChild(script);
        } else {
            setCloudinaryLoaded(true);
        }

        onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                router.push('/Login');
            } else {
                setUser(currentUser);
                setFormData(prev => ({ ...prev, procterId: currentUser.uid }));
                
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    setUserType(userDoc.data().type);
                }
            }
        });
    }, [auth, router, db]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setFormData((prev) => ({ ...prev, [name]: newValue }));
    };

    const handleImageUpload = () => {
        if (cloudinaryLoaded && window.cloudinary) {
            window.cloudinary.openUploadWidget(
                {
                    cloudName: "dwkxh75ux",
                    uploadPreset: "sharepics",
                    sources: ["local", "url", "camera"],
                    cropping: true,
                    multiple: false,
                    resourceType: "image",
                },
                (error, result) => {
                    if (!error && result && result.event === "success") {
                        setFormData((prev) => ({
                            ...prev,
                            imageUrl: result.info.secure_url,
                        }));
                    } else if (error) {
                        console.log("Upload error:", error);
                    }
                }
            );
        } else {
            console.log("Cloudinary is not loaded yet.");
        }
    };

    const handleRequirementAdd = () => {
        if (minRequirement) {
            setFormData((prev) => ({
                ...prev,
                minimumRequirements: [...prev.minimumRequirements, minRequirement],
            }));
            setMinRequirement('');
        }
    };

    const handleLearningAdd = () => {
        if (learningPoint) {
            setFormData((prev) => ({
                ...prev,
                whatYouWillLearn: [...prev.whatYouWillLearn, learningPoint],
            }));
            setLearningPoint('');
        }
    };

    const handleRequirementDelete = async (item) => {
        try {
            const updatedRequirements = formData.minimumRequirements.filter((req) => req !== item);
            setFormData((prev) => ({
                ...prev,
                minimumRequirements: updatedRequirements,
            }));
        } catch (error) {
            console.error("Error removing requirement:", error);
            setError("Error removing requirement");
        }
    };

    const handleLearningDelete = async (item) => {
        try {
            const updatedLearning = formData.whatYouWillLearn.filter((learn) => learn !== item);
            setFormData((prev) => ({
                ...prev,
                whatYouWillLearn: updatedLearning,
            }));
        } catch (error) {
            console.error("Error removing learning point:", error);
            setError("Error removing learning point");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        setIsLoading(true);
        setError(null);

        try {
            const classDoc = await addDoc(collection(db, 'classesCollection'), formData);

            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const currentDate = new Date();
                const dateString = currentDate.toDateString();
                const timestamp = currentDate.toISOString();
                
                const userData = userDocSnap.data();
                let dailyBalance = userData.dailyBalance || 0;
                let balance = userData.balance || 0;
                let numberOfTeaching = userData.numberOfTeaching || 0;
                const lastUpdated = userData.lastUpdated || null;

                if (lastUpdated !== dateString) {
                    dailyBalance = 0;
                }

                let increment = Math.min(50, 250 - dailyBalance);
                if (increment > 0) {
                    dailyBalance += increment;
                    balance += increment;
                }

                const balanceEntry = {
                    date: timestamp,
                    balance: balance,
                    change: increment,
                    type: 'class_creation'
                };

                const teachingEntry = {
                    date: formData.classDate,
                    title: formData.className,
                    classId: classDoc.id
                };

                await updateDoc(userDocRef, {
                    dailyBalance,
                    balance,
                    lastUpdated: dateString,
                    balanceHistory: arrayUnion(balanceEntry),
                    numberOfTeaching: numberOfTeaching + 1,
                    recentTeaching: arrayUnion(teachingEntry)
                });
            }
            setSubmitted(true);
        } catch (error) {
            console.error("Error saving class data:", error);
            setError("Error saving class data");
        } finally {
            setIsLoading(false);
        }
    };

    const validateSection = (section) => {
        switch(section) {
            case 1:
                return formData.className && formData.standard && formData.classType;
            case 2:
                return formData.classDate && formData.classTime && formData.classLink;
            case 3:
                return formData.description && formData.description.length > 10;
            default:
                return true;
        }
    };

    const nextSection = () => {
        if (validateSection(activeSection)) {
            setActiveSection(prev => Math.min(prev + 1, 4));
        }
    };

    const prevSection = () => {
        setActiveSection(prev => Math.max(prev - 1, 1));
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };

    const renderSection = () => {
        switch(activeSection) {
            case 1:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-8">Basic Information</h2>
                        
                        <div className="relative group">
                            <input
                                type="text"
                                name="className"
                                value={formData.className}
                                onChange={handleChange}
                                required
                                placeholder=" "
                                className="w-full p-4 border-b-2 border-gray-300 focus:border-indigo-600 outline-none transition-all bg-transparent text-lg"
                            />
                            <label className="absolute left-0 top-4 text-gray-500 transition-all duration-300 pointer-events-none group-focus-within:text-xs group-focus-within:-top-0 transform group-focus-within:text-indigo-600" 
                                style={{
                                    transform: formData.className ? 'translateY(-24px) scale(0.75)' : '',
                                    color: formData.className ? '#4F46E5' : ''
                                }}
                            >
                                Class Name
                            </label>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                name="standard"
                                value={formData.standard}
                                onChange={handleChange}
                                required
                                placeholder=" "
                                className="w-full p-4 border-b-2 border-gray-300 focus:border-indigo-600 outline-none transition-all bg-transparent text-lg"
                            />
                            <label className="absolute left-0 top-4 text-gray-500 transition-all duration-300 pointer-events-none group-focus-within:text-xs group-focus-within:-top-0 transform group-focus-within:text-indigo-600" 
                                style={{
                                    transform: formData.standard ? 'translateY(-24px) scale(0.75)' : '',
                                    color: formData.standard ? '#4F46E5' : ''
                                }}
                            >
                                Age Group
                            </label>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                name="classType"
                                value={formData.classType}
                                onChange={handleChange}
                                required
                                placeholder=" "
                                className="w-full p-4 border-b-2 border-gray-300 focus:border-indigo-600 outline-none transition-all bg-transparent text-lg"
                            />
                            <label className="absolute left-0 top-4 text-gray-500 transition-all duration-300 pointer-events-none group-focus-within:text-xs group-focus-within:-top-0 transform group-focus-within:text-indigo-600" 
                                style={{
                                    transform: formData.classType ? 'translateY(-24px) scale(0.75)' : '',
                                    color: formData.classType ? '#4F46E5' : ''
                                }}
                            >
                                Class Type
                            </label>
                        </div>

                        {(userType === "Teacher" || userType === "Professional") && (
                            <div className="flex items-center space-x-3 p-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        name="isPremium"
                                        checked={formData.isPremium}
                                        onChange={handleChange}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    <span className="ml-3 text-gray-700 font-medium">Premium Class</span>
                                </label>
                                {formData.isPremium && (
                                    <span className="ml-2 py-1 px-3 text-xs font-bold bg-amber-400 text-amber-900 rounded-full">
                                        Premium Only
                                    </span>
                                )}
                            </div>
                        )}
                    </motion.div>
                );
            case 2:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-8">Schedule & Access</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative group">
                                <label className="block text-gray-600 font-medium mb-1">Class Date:</label>
                                <input
                                    type="date"
                                    name="classDate"
                                    value={formData.classDate}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring focus:ring-indigo-200 outline-none transition-all"
                                />
                            </div>
                            
                            <div className="relative group">
                                <label className="block text-gray-600 font-medium mb-1">Class Time:</label>
                                <input
                                    type="time"
                                    name="classTime"
                                    value={formData.classTime}
                                    onChange={handleChange}
                                    required
                                    className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring focus:ring-indigo-200 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="relative group p-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50">
                            <label className="block text-gray-700 font-medium mb-2">
                                <span className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                    </svg>
                                    Virtual Meeting Link:
                                </span>
                            </label>
                            <input
                                type="text"
                                name="classLink"
                                value={formData.classLink}
                                onChange={handleChange}
                                placeholder="Enter Google Meet URL"
                                className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring focus:ring-indigo-200 outline-none transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Provide a link where students can join your virtual class session
                            </p>
                        </div>

                        <div className="mt-6">
                            <div onClick={handleImageUpload} className="cursor-pointer">
                                {formData.imageUrl ? (
                                    <div className="relative">
                                        <img
                                            src={formData.imageUrl}
                                            alt="Class Image"
                                            className="w-full h-64 object-cover rounded-xl shadow-md"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                                            <span className="text-white font-medium">Change Image</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                        </svg>
                                        <h3 className="mt-2 text-gray-700 font-medium">Upload Class Cover Image</h3>
                                        <p className="text-sm text-gray-500">Click to upload (JPG, PNG)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                );
            case 3:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Class Content</h2>
                        
                        <div>
                            <label className="block text-gray-600 font-medium mb-2">Class Description:</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                required
                                rows="4"
                                placeholder="Describe what this class is about..."
                                className="w-full p-4 border-2 border-gray-300 rounded-xl focus:border-indigo-600 focus:ring focus:ring-indigo-200 outline-none transition-all"
                            />
                        </div>

                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-100">
                            <h3 className="text-lg font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                What Students Will Learn:
                            </h3>
                            <div className="flex mb-3">
                                <input
                                    type="text"
                                    value={learningPoint}
                                    onChange={(e) => setLearningPoint(e.target.value)}
                                    placeholder="Add a learning objective..."
                                    className="w-full p-3 border-2 border-indigo-200 rounded-l-lg focus:border-indigo-600 focus:ring focus:ring-indigo-200 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleLearningAdd}
                                    className="px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-r-lg hover:from-indigo-700 hover:to-purple-700 transition duration-200"
                                >
                                    Add
                                </button>
                            </div>
                            <ul className="space-y-2">
                                {formData.whatYouWillLearn.map((item, index) => (
                                    <li key={index} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                                        <span className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-green-500">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                            {item}
                                        </span>
                                        <button
                                            onClick={() => handleLearningDelete(item)}
                                            className="text-red-500 hover:text-red-700 p-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </li>
                                ))}
                                {formData.minimumRequirements.length === 0 && (
                                    <li className="text-gray-500 italic text-sm">No prerequisites added yet</li>
                                )}
                            </ul>
                        </div>
                    </motion.div>
                );
            case 4:
                return (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <h2 className="text-2xl font-bold text-gray-800 mb-6">Preview & Submit</h2>
                        
                        <div className="relative overflow-hidden rounded-xl bg-white shadow-lg border border-gray-100">
                            {formData.imageUrl ? (
                                <div className="h-48 overflow-hidden">
                                    <img 
                                        src={formData.imageUrl} 
                                        alt="Class Cover" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-white">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                    </svg>
                                </div>
                            )}
                            
                            <div className="p-6">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-xl font-bold text-gray-800">{formData.className || "Class Name"}</h3>
                                    {formData.isPremium && (
                                        <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-white text-xs font-bold rounded-full">
                                            PREMIUM
                                        </span>
                                    )}
                                </div>
                                
                                <div className="mt-3 flex items-center text-gray-600 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                    </svg>
                                    {formData.standard || "Age Group"}
                                </div>
                                
                                <div className="mt-1 flex items-center text-gray-600 text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                                    </svg>
                                    {formData.classType || "Class Type"}
                                </div>
                                
                                {formData.classDate && (
                                    <div className="mt-1 flex items-center text-gray-600 text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
                                        </svg>
                                        {formatDate(formData.classDate)}
                                    </div>
                                )}
                                
                                {formData.classTime && (
                                    <div className="mt-1 flex items-center text-gray-600 text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {formData.classTime}
                                    </div>
                                )}
                                
                                <div className="mt-4">
                                    <h4 className="font-medium text-gray-800">Description:</h4>
                                    <p className="text-gray-600 mt-1">
                                        {formData.description || "No description provided."}
                                    </p>
                                </div>
                                
                                {formData.whatYouWillLearn.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-medium text-gray-800">What You'll Learn:</h4>
                                        <ul className="mt-1 space-y-1">
                                            {formData.whatYouWillLearn.map((item, index) => (
                                                <li key={index} className="flex items-start">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-500 mt-1 mr-2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                                    </svg>
                                                    <span className="text-gray-600">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                {formData.minimumRequirements.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-medium text-gray-800">Prerequisites:</h4>
                                        <ul className="mt-1 space-y-1">
                                            {formData.minimumRequirements.map((item, index) => (
                                                <li key={index} className="flex items-start">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-amber-500 mt-1 mr-2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                                    </svg>
                                                    <span className="text-gray-600">{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                
                                {formData.classLink && (
                                    <div className="mt-4">
                                        <h4 className="font-medium text-gray-800">Meeting Link:</h4>
                                        <a href={formData.classLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 flex items-center mt-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                                            </svg>
                                            Join Meeting
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-6">
                            <button
                                type="submit"
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition duration-300 shadow-md hover:shadow-lg flex items-center justify-center"
                            >
                                {isLoading ? (
                                    <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : null}
                                {isLoading ? "Publishing..." : "Publish Class"}
                            </button>
                            
                            {error && (
                                <p className="mt-2 text-red-600 text-center">
                                    {error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                );
            default:
                return null;
        }
    };

    const progressSteps = [
        { label: "Basic Info", icon: "📝" },
        { label: "Schedule", icon: "🗓" },
        { label: "Content", icon: "📚" },
        { label: "Preview", icon: "👁" }
    ];

    return !submitted ? (
        <div className={`min-h-screen ${colors.background} py-16 px-4 sm:px-6 lg:px-8`}>
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Create Your Class</h1>
                    <p className="mt-3 text-xl text-gray-600">Share your knowledge with the world</p>
                </div>
                
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
                    <div className="p-6 sm:p-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex -space-x-2">
                                {progressSteps.map((step, index) => (
                                    <button
                                        key={index}
                                        onClick={() => validateSection(activeSection) && setActiveSection(index + 1)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                                            activeSection === index + 1
                                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                                : index + 1 < activeSection
                                                ? 'border-green-500 bg-green-500 text-white'
                                                : 'border-gray-300 bg-white text-gray-500'
                                        } z-10`}
                                        style={{ marginLeft: index === 0 ? 0 : '-8px' }}
                                    >
                                        {index + 1 < activeSection ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        ) : (
                                            <span>{index + 1}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="text-sm font-medium text-gray-500">
                                Step {activeSection} of {progressSteps.length}
                            </div>
                        </div>
                        
                        <div className="relative">
                            <form onSubmit={(e) => e.preventDefault()}>
                                {renderSection()}
                            </form>
                        </div>
                        
                        <div className="mt-8 flex justify-between">
                            {activeSection > 1 ? (
                                <button
                                    onClick={prevSection}
                                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition duration-200"
                                >
                                    Back
                                </button>
                            ) : (
                                <div></div>
                            )}
                            
                            {activeSection < 4 && (
                                <button
                                    onClick={nextSection}
                                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition duration-200"
                                >
                                    Continue
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ) : (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="w-20 h-20 bg-green-100 mx-auto rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-green-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                
                <h1 className="text-3xl font-bold text-gray-800 mt-6">Class Published!</h1>
                <p className="text-gray-600 mt-2">Your class has been successfully published and is now available for students to join.</p>
                
                <div className="mt-12 space-y-4">
                    <Link href="/Learn&Share/Learn">
                        <button className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition duration-300 shadow-md hover:shadow-lg">
                            Go to Classes
                        </button>
                    </Link>
                    
                    <button className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition duration-300">
                        Share Your Class
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClassesEntry;