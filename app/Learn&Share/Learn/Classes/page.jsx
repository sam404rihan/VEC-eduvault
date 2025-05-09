"use client"
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { doc, getDoc, getFirestore, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import {firebaseApp} from '../../../../firebaseConfig';
import styled from 'styled-components';
import { getAuth } from 'firebase/auth';
import Image from 'next/image';
import { Calendar, Users, Star, Clock, Mail, MessageSquare, Heart, Award, Clock3, BookOpen, Target } from 'lucide-react';
import ReactStars from 'react-stars'
import Loader from './loader';

const ClassDetail = () => {
  const [user, setUser] = useState(null);
  const auth = getAuth(firebaseApp);
  const router = useRouter();
  const path = usePathname();
  const classId = path.split('/').pop();
  const [classData, setClassData] = useState(null);
  const [proctorData, setProctorData] = useState(null);
  const [interestedCount, setInterestedCount] = useState(0);
  const [isInterested, setIsInterested] = useState(false);
  const db = getFirestore(firebaseApp);

  const [rating, setRating] = useState({
    userRating: 0,
    averageRating: 0,
    isSubmitting: false
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setUser(user);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const fetchClassData = async () => {
      if (classId && user) {
        const classRef = doc(db, 'classesCollection', classId);
        const docSnap = await getDoc(classRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setClassData(data);
          setInterestedCount(data.interestedUsers?.length || 0);
          setIsInterested(data.interestedUsers?.includes(user.uid) || false);

          if (data.procterId) {
            const proctorRef = doc(db, 'users', data.procterId);
            const proctorSnap = await getDoc(proctorRef);
            
            if (proctorSnap.exists()) {
              const proctorInfo = proctorSnap.data();
              setProctorData(proctorInfo);

              if (proctorInfo.ratings) {
                const ratings = Object.values(proctorInfo.ratings);
                const avg = ratings.length > 0 
                  ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
                  : 0;
                
                setRating({
                  userRating: proctorInfo.ratings[user.uid] || 0,
                  averageRating: Number(avg.toFixed(1)),
                  isSubmitting: false
                });
              }
            }
          }
        } else {
          router.push('/404');
        }
      }
    };

    fetchClassData();
  }, [classId, db, router, user]);


  const handleCheckboxChange = async () => {
    if (!user) {
      alert("Please log in to show your interest!");
      return;
    }

    const newInterestedState = !isInterested;
    const classRef = doc(db, 'classesCollection', classId);
    const userRef = doc(db, "users", user.uid);

    try {
      if (newInterestedState) {
        await updateDoc(classRef, {
          interestedUsers: arrayUnion(user.uid)
        });
        setInterestedCount(prevCount => prevCount + 1);
          
      

        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const currentDate = new Date().toDateString();
          const userData = userDoc.data();
          let dailyBalance = userData.dailyBalance || 0;
          let balance = userData.balance || 0;
          const lastUpdated = userData.lastUpdated || null;

          if (lastUpdated !== currentDate) {
            dailyBalance = 0;
          }
           

          const checkboxHistory = userData.checkboxHistory || {};
          if (!checkboxHistory[classId]) {
            if (dailyBalance < 250) {
              const remainingBalance = 250 - dailyBalance;
              const increment = Math.min(10, remainingBalance);
              dailyBalance += increment;
              balance += increment;
  
              await updateDoc(userRef, {
                dailyBalance,
                balance,
                lastUpdated: currentDate,
                checkboxHistory: {
                  ...checkboxHistory,
                  [classId]: true,
                },
              });
            }
          }
        }
  
      } else {
        await updateDoc(classRef, {
          interestedUsers: arrayRemove(user.uid)
        });
        setInterestedCount(prevCount => prevCount - 1);
      }
  
      setIsInterested(newInterestedState);

    } catch (error) {
      console.error("Error updating Firestore:", error);
      setIsInterested(!newInterestedState);
    }
  };

  const handleRatingChange = async (newRating) => {
    if (!user) {
      alert("Please log in to rate the proctor!");
      return;
    }

    if (!proctorData || !classData?.procterId) {
      console.error("Missing proctor data or ID");
      return;
    }

    setRating(prev => ({ ...prev, isSubmitting: true }));

    try {
      const proctorRef = doc(db, 'users', classData.procterId);
      const proctorSnap = await getDoc(proctorRef);
      
      if (!proctorSnap.exists()) {
        throw new Error("Proctor document not found");
      }

      const currentRatings = proctorSnap.data().ratings || {};
      const newRatings = {
        ...currentRatings,
        [user.uid]: newRating
      };

      const ratingsArray = Object.values(newRatings);
      const newAverage = ratingsArray.reduce((a, b) => a + b, 0) / ratingsArray.length;

      await updateDoc(proctorRef, {
        ratings: newRatings,
        averageRating: newAverage
      });

      setRating({
        userRating: newRating,
        averageRating: Number(newAverage.toFixed(1)),
        isSubmitting: false
      });

      alert("Rating submitted successfully!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("Failed to submit rating. Please try again.");
    } finally {
      setRating(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const ProctorCard = ({ proctorData, db, user, classData }) => {
    const [ratingState, setRatingState] = useState({
      userRating: 0,
      averageRating: 0,
      isSubmitting: false
    });
  
    useEffect(() => {
      if (proctorData?.ratings) {
        const ratings = Object.values(proctorData.ratings);
        const avg = ratings.length > 0 
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
          : 0;
        
        setRatingState({
          userRating: user && proctorData.ratings[user?.uid] ? proctorData.ratings[user.uid] : 0,
          averageRating: Number(avg.toFixed(1)),
          isSubmitting: false
        });
      }
    }, [proctorData, user]);
  
    const handleRatingSubmit = async (newRating) => {
      if (!user) {
        alert("Please log in to rate the proctor!");
        return;
      }
  
      if (!proctorData || !classData?.procterId) {
        console.error("Missing proctor data or ID");
        return;
      }
  
      setRatingState(prev => ({ ...prev, isSubmitting: true }));
  
      try {
        const proctorRef = doc(db, 'users', classData.procterId);
        const proctorSnap = await getDoc(proctorRef);
        
        if (!proctorSnap.exists()) {
          throw new Error("Proctor document not found");
        }
  
        const currentRatings = proctorSnap.data().ratings || {};
        const newRatings = {
          ...currentRatings,
          [user.uid]: newRating
        };
  
        const ratingsArray = Object.values(newRatings);
        const newAverage = ratingsArray.reduce((a, b) => a + b, 0) / ratingsArray.length;
  
        await updateDoc(proctorRef, {
          ratings: newRatings,
          averageRating: newAverage
        });
  
        if (classData.id) {
          const classRef = doc(db, 'classesCollection', classData.id);
          await updateDoc(classRef, {
            proctorRating: newAverage
          });
        }
  
        setRatingState({
          userRating: newRating,
          averageRating: Number(newAverage.toFixed(1)),
          isSubmitting: false
        });
  
      } catch (error) {
        console.error("Error submitting rating:", error);
        alert("Failed to submit rating. Please try again.");
        setRatingState(prev => ({ ...prev, isSubmitting: false }));
      }
    };
  
    if (!proctorData) return null;
  
    return (
      <div className="font-['Poppins'] w-full max-w-4xl mx-auto mt-16 mb-12">
        <h1 className="text-3xl font-bold mb-8 text-gray-800 flex items-center gap-3">
          <Award className="w-7 h-7 text-amber-500" />
          Meet Your Proctor
        </h1>
        
        <div className="bg-white rounded-3xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl border border-amber-100">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row items-start md:items-center gap-8 mb-8 pb-8 border-b border-amber-100">
            <div className="relative">
              <div className="w-36 h-36 rounded-2xl overflow-hidden ring-4 ring-amber-100 shadow-lg transform transition-all duration-300 hover:scale-105">
                <Image 
                  src={proctorData.profilePic || '/deaf.png'} 
                  alt="Proctor Image" 
                  width={144}
                  height={144}
                  className="object-cover w-full h-full"
                  onError={(e) => {e.currentTarget.src = '/deaf.png'}}
                />
              </div>
            </div>
            
            <div className="flex-grow">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between w-full">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    {proctorData.firstName} {proctorData.lastName}
                  </h2>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                      {proctorData.type}
                    </span>
                    {ratingState.averageRating > 0 && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-current" /> 
                        {ratingState.averageRating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <button className="mt-4 md:mt-0 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-6 py-3 rounded-lg transition duration-200 flex items-center justify-center gap-2 shadow-md font-medium transform hover:translate-y-[-2px]">
                  <MessageSquare className="w-5 h-5" />
                  <span>Join Class</span>
                </button>
              </div>
            </div>
          </div>
  
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">            
            <div className="bg-amber-50 rounded-xl p-5 transition-all duration-200 hover:bg-amber-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <span className="text-gray-600 font-medium">Classes Completed</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{proctorData.numberOfTeaching || '0'}</p>
            </div> 
            
            <div className="bg-amber-50 rounded-xl p-5 transition-all duration-200 hover:bg-amber-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-5 h-5 text-amber-600" />
                <span className="text-gray-600 font-medium">Rating</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-gray-800">{ratingState.averageRating}</p>
                  <ReactStars
                    count={5}
                    value={ratingState.averageRating}
                    size={24}
                    color2={'#f59e0b'}
                    edit={false}
                    half={true}
                  />
                </div>
                {user && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-1">Your Rating:</p>
                    <ReactStars
                      count={5}
                      onChange={handleRatingSubmit}
                      size={24}
                      value={ratingState.userRating}
                      half={true}
                      color2={'#f59e0b'}
                      disabled={ratingState.isSubmitting}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-5 transition-all duration-200 hover:bg-amber-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-amber-600" />
                <span className="text-gray-600 font-medium">Students Taught</span>
              </div>
              <p className="text-2xl font-bold text-gray-800">{proctorData.studentsCount || '250+'}</p>
            </div>
          </div>
  
          {/* Bio Section */}
          <div className="mb-8 bg-white p-6 rounded-xl border border-amber-100">
            <h3 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              About Me
            </h3>
            <p className="text-gray-600 leading-relaxed">
              {proctorData.bio || "Experienced educator passionate about making learning accessible and enjoyable for all students. Specialized in creating inclusive learning environments and adapting teaching methods to individual needs."}
            </p>
          </div>
  
          {/* Teaching Philosophy */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
              <Heart className="w-5 h-5 text-amber-500" />
              Teaching Philosophy
            </h3>
            <p className="text-gray-600">
              {proctorData.philosophy || "Every student has unique potential. My role is to create an inclusive environment where all students can thrive and achieve their learning goals."}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!classData) return <div className='min-h-screen flex items-center justify-center'><Loader/></div>;
  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-8 bg-gradient-to-b from-amber-50 to-white text-gray-900 font-['Poppins']">
      {/* Hero section */}
      <div className="w-full max-w-6xl mb-10 relative">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-8 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400 rounded-full -mr-20 -mt-20 opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-400 rounded-full -ml-10 -mb-10 opacity-20"></div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 relative z-10 max-w-3xl">
            {classData.className}
          </h1>
          <div className="flex flex-wrap gap-3 relative z-10">
            <span className="px-3 py-1 bg-amber-100/30 backdrop-blur-sm text-white rounded-full text-sm font-medium">
              {classData.standard}
            </span>
            <span className="px-3 py-1 bg-amber-100/30 backdrop-blur-sm text-white rounded-full text-sm font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {classData.classDate}
            </span>
            <span className="px-3 py-1 bg-amber-100/30 backdrop-blur-sm text-white rounded-full text-sm font-medium flex items-center gap-1">
              <Clock3 className="w-3.5 h-3.5" /> {classData.classTime}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row items-start w-full max-w-6xl gap-8">
        {/* Main content */}
        <div className="w-full md:w-2/3">
          {/* Class image */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8 transform transition-transform duration-300 hover:shadow-xl">
            <img
              src={classData.imageUrl}
              alt="Class Image"
              className="w-full h-80 object-cover"
            />
          </div>

          {/* Class details */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <BookOpen className="w-6 h-6 text-amber-500" />
              Description
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              {classData.description}
            </p>
            
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <Target className="w-6 h-6 text-amber-500" />
              What You Will Learn
            </h2>
            <ul className="mb-6">
              {classData.whatYouWillLearn.map((item, idx) => (
                <li key={idx} className="mb-2 flex items-start">
                  <div className="mr-2 mt-1.5 text-amber-500">•</div>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
            
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <Users className="w-6 h-6 text-amber-500" />
              Minimum Requirements
            </h2>
            <ul>
              {classData.minimumRequirements.map((req, idx) => (
                <li key={idx} className="mb-2 flex items-start">
                  <div className="mr-2 mt-1.5 text-amber-500">•</div>
                  <span className="text-gray-700">{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-1/3 mt-0 md:mt-0">
          <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-4 border border-amber-100">
            <div className="mb-6 pb-6 border-b border-amber-100">
              <a 
                href={classData.classLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="block w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-6 py-4 rounded-xl transition duration-200 shadow-md font-medium text-center transform transition-transform hover:translate-y-[-2px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
                    <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h480q33 0 56.5 23.5T720-720v180l160-160v440L720-420v180q0 33-23.5 56.5T640-160H160Zm0-80h480v-480H160v480Zm0 0v-480 480Z"/>
                  </svg>
                  Join Google Meet
                </div>
              </a>
            </div>
            
            <div className="mb-6 pb-6 border-b border-amber-100">
              <h3 className="text-lg font-semibold mb-4">Show Interest</h3>
              <div className="flex items-center gap-4">
                <Checkbox onChange={handleCheckboxChange} checked={isInterested} />
                <span className="text-gray-700">
                  {interestedCount} people are interested
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Rate This Class</h3>
              {user && (
                <div className="flex items-center">
                  <ReactStars
                    count={5}
                    onChange={handleRatingChange}
                    size={30}
                    value={rating.userRating}
                    half={true}
                    color2={'#f59e0b'}
                    disabled={rating.isSubmitting}
                  />
                </div>
              )}
              {!user && (
                <p className="text-sm text-gray-500">Log in to rate this class</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Proctor section */}
      <ProctorCard proctorData={proctorData} db={db} user={user} classData={classData} />
    </div>
  );
};


const Checkbox = ({ onChange, checked, disabled }) => {
  return (
    <StyledWrapper>
      <div className="heart-container" title="Like">
        <input 
          type="checkbox" 
          className="checkbox" 
          id="Give-It-An-Id" 
          onChange={onChange} 
          checked={checked} 
          disabled={disabled}
        />
        <div className="svg-container">
          <svg viewBox="0 0 24 24" className="svg-outline" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Zm-3.585,18.4a2.973,2.973,0,0,1-3.83,0C4.947,16.006,2,11.87,2,8.967a4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,11,8.967a1,1,0,0,0,2,0,4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,22,8.967C22,11.87,19.053,16.006,13.915,20.313Z"></path>
          </svg>
          <svg viewBox="0 0 24 24" className="svg-filled" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Z"></path>
          </svg>
        </div>
      </div>
    </StyledWrapper>
  );
};


const StyledWrapper = styled.div`
  .heart-container {
    --heart-color: rgb(245, 158, 11);
    position: relative;
    width: 40px;
    height: 40px;
    transition: transform 0.3s ease-in-out;
  }

  .heart-container .checkbox {
    position: absolute;
    width: 100%;
    height: 100%;
    opacity: 0;
    z-index: 20;
    cursor: pointer;
  }

  .heart-container .svg-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .heart-container .svg-outline,
  .heart-container .svg-filled {
    fill: var(--heart-color);
    position: absolute;
    width: 30px;
    height: 30px;
    transition: all 0.3s;
  }

  .heart-container .svg-filled {
    animation: keyframes-svg-filled 0.5s;
    display: none;
    transform: scale(0);
  }

  .heart-container .checkbox:checked ~ .svg-container .svg-filled {
    display: block;
    transform: scale(1);
  }

  .heart-container:hover {
    transform: scale(1.15);
  }

  @keyframes keyframes-svg-filled {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    25% {
      transform: scale(1.2);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .rating:not(:checked) > input {
    position: absolute;
    appearance: none;
  }

  .rating:not(:checked) > label {
    float: right;
    cursor: pointer;
    font-size: 30px;
    color: #ccc;
    transition: all 0.2s ease;
  }

  .rating:not(:checked) > label:before {
    content: '★';
  }

  .rating > input:checked + label:hover,
  .rating > input:checked + label:hover ~ label,
  .rating > input:checked ~ label:hover,
  .rating > input:checked ~ label:hover ~ label,
  .rating > label:hover ~ input:checked ~ label {
    color: #f59e0b;
    transform: scale(1.1);
  }

  .rating:not(:checked) > label:hover,
  .rating:not(:checked) > label:hover ~ label {
    color: #f59e0b;
    transform: scale(1.1);
  }

  .rating > input:checked ~ label {
    color: #f59e0b;
  }
`;

export default ClassDetail;