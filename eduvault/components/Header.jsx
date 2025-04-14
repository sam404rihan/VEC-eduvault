"use client";
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import img from '../public/images/logo.png';
import profilePic from '../public/images/profile.png';
import { FaSpinner } from 'react-icons/fa'; 
import signOutPic from '../public/images/signout.png';
import Loader from './Loader';
import { firebaseApp } from '../firebaseConfig';
function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const db = getFirestore(firebaseApp);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  return (
    <div className="flex flex-row justify-center lg:justify-around items-center mt-12 ml-6 mr-6 sm:mb-3 mb-3">
      <div className="lg:flex w-screen lg:justify-between h-7 items-center">

        <Link href="/">
          <button className="h-11 lg:w-54 flex justify-center  md:h-11 w-44">
            <Image src={img} alt="logo" width={150} height={50} />
          </button>
        </Link>

        <div className="lg:flex hidden justify-between gap-3 items-center">
  <div style={{ height: '50px' }} className="flex items-center">
    {loading ? (<div className='mx-[163px]'>
      <Loader /></div>
    ) : user ? (
      <div className="flex items-center gap-3">
        <span className="flex items-center ml-2">
          <Link href="/DashBoard">
            <Image
              src={profilePic}
              alt={userProfile?.firstName || 'User'}
              width={40}
              height={40}
              className="rounded-full"
            />
          </Link>
          <span className="ml-5 text-xl font-semibold wave-effect">
            {userProfile?.firstName}
          </span>
        </span>
        <button
          onClick={handleSignOut}
          style={{ fontFamily: '"Josefin Sans", sans-serif' }}
          className="px-3 py-2 mx-9 font-bold text-white rounded-full h-11 transition duration-400 bg-black hover:bg-gray-700 w-32 flex items-center justify-center space-x-2"
        >
          <span>Sign Out</span>
          <Image
            src={signOutPic}
            alt="Sign Out"
            width={20}
            height={20}
            className="rounded-full"
          />
        </button>
      </div>
    ) : (
      <><div className='w-40 h-12'></div>
        <Link href="/Login">
          <button
            style={{ fontFamily: '"Josefin Sans", sans-serif' }}
            className="text-lg rounded-lg w-20 font-bold text-gray-500 hover:text-black ease-in-out transition duration border-rad"
          >
            Log in
          </button>
        </Link>
        <Link href="/SignUp">
          <button
            style={{ fontFamily: '"Josefin Sans", sans-serif' }}
            className="text-lg rounded-lg w-20 font-bold text-gray-500 hover:text-black ease-in-out transition duration border-rad"
          >
            Signup
          </button>
        </Link>
      </>
    )}
  </div>
</div>

      </div>

      

    </div>
  );
}

export default Header;
