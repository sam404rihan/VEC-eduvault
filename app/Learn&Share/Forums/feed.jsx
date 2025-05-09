"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { useRouter } from 'next/navigation'; 
import { collection, getDoc, getDocs, doc, updateDoc, deleteDoc, query, where, arrayUnion, arrayRemove, getDoc as getSingleDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import styled from 'styled-components';
import Loader from './loader';
import { PlusCircle, UserCircle, Eye, Heart, MessageCircle, X, Reply, Trash2 } from 'lucide-react';

// Update StyledModal component
const StyledModal = styled.div`
  .modal {
    backdrop-filter: blur(8px);
    background-color: rgba(0, 0, 0, 0.6);
  }
  
  .comment-box {
    transform: translateY(-5%);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-in-out;
    background-color: #ffffff;
  }
  
  .comment-box.show {
    transform: translateY(0);
    opacity: 1;
  }
  
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #88acac;
    border-radius: 8px;
    border: 1px solid #f1f1f1;
  }

  .image-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }

  .image-modal.show {
    opacity: 1;
  }

  .modal-image {
    max-width: 90%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
    transform: scale(0.9);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  .image-modal.show .modal-image {
    transform: scale(1);
  }

  .close-button {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    padding: 8px;
    cursor: pointer;
    transition: background-color 0.3s ease, transform 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: rotate(90deg);
  }
`;

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMyPosts, setShowMyPosts] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const router = useRouter();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const postsCollectionRef = collection(db, 'posts');
        let q = showMyPosts && currentUser
          ? query(postsCollectionRef, where("userId", "==", currentUser.uid))
          : postsCollectionRef;

        const querySnapshot = await getDocs(q);
        const postsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPosts(postsData);
      } catch (error) {
        console.error("Error fetching posts: ", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [showMyPosts, currentUser]);

  const ImageModal = ({ imageUrl, onClose }) => {
    useEffect(() => {
      const modalElement = document.querySelector('.image-modal');
      setTimeout(() => modalElement?.classList.add('show'), 10);
      
      const handleEscape = (e) => {
        if (e.key === 'Escape') onClose();
      };
      
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    return (
      <div className="image-modal" onClick={onClose}>
        <button className="close-button" onClick={onClose}>
          <X size={24} color="white" />
        </button>
        <img 
          src={imageUrl} 
          alt="Enlarged post" 
          className="modal-image"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  };

  const updateUserBalance = async (views, count, userId) => {
    if (!currentUser || !userId) return;

    const userDocRef = doc(db, "users", userId);
    try {
      const userDoc = await getSingleDoc(userDocRef);
      if (!userDoc.exists()) {
        console.error("Creator's user document not found for ID:", userId);
        return;
      }

      const userData = userDoc.data();
      let dailyBalance = userData.dailyBalance || 0;
      let balance = userData.balance || 0;
      const lastUpdated = userData.lastUpdated || null;
      const currentDate = new Date().toDateString();

      if (!userData.lastUpdated) {
        await updateDoc(userDocRef, {
          lastUpdated: currentDate,
          dailyBalance: 0,
        });
      }

      if (lastUpdated !== currentDate) {
        dailyBalance = 0;
        await updateDoc(userDocRef, {
          dailyBalance: 0,
          lastUpdated: currentDate,
        });
      }

      if ((views % 100 === 0 || count % 25 === 0) && dailyBalance < 250) {
        const increment = Math.min(5, 250 - dailyBalance);
        dailyBalance += increment;
        balance += increment;

        const balanceHistory = userData.balanceHistory || [];
        const newHistoryEntry = {
          balance,
          date: currentDate,
        };
        balanceHistory.push(newHistoryEntry);

        await updateDoc(userDocRef, {
          dailyBalance,
          balance,
          balanceHistory,
        });
      }
    } catch (error) {
      console.error("Error updating user balance: ", error);
    }
  };

  const FeedCard = ({ profilePic, name, time, title, content, views, likes = [], comments = [], id, imageUrl, userId }) => {
    const [isCommentModalVisible, setCommentModalVisible] = useState(false);
    const [commentList, setCommentList] = useState(comments.map(comment => ({
      ...comment,
      likes: Array.isArray(comment.likes) ? comment.likes : [],
      replies: Array.isArray(comment.replies) ? comment.replies.map(reply => ({
        ...reply,
        likes: Array.isArray(reply.likes) ? reply.likes : []
      })) : []
    })));
    const [localLikes, setLocalLikes] = useState(likes);
    const [liked, setLiked] = useState(Array.isArray(likes) && likes.includes(currentUser?.uid));
    const [replyingTo, setReplyingTo] = useState(null);
    const [userType, setUserType] = useState(null);
    const [commentText, setCommentText] = useState('');
    const [replyText, setReplyText] = useState('');

    useEffect(() => {
      const fetchUserType = async () => {
        if (currentUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              setUserType(userDoc.data().type || 'User');
            }
          } catch (error) {
            console.error("Error fetching user type:", error);
          }
        }
      };
      fetchUserType();
    }, [currentUser]);

    const handleCommentLike = async (commentIndex, isReply = false, parentIndex = null) => {
      if (!currentUser) return;
    
      try {
        const updatedComments = [...commentList];
        let targetComment;
        let likes;
    
        if (isReply && parentIndex !== null) {
          targetComment = updatedComments[parentIndex]?.replies?.[commentIndex];
        } else {
          targetComment = updatedComments[commentIndex];
        }
    
        if (!targetComment) {
          console.error("Target comment not found");
          return;
        }
    
        if (!Array.isArray(targetComment.likes)) {
          targetComment.likes = [];
        }
    
        const likeIndex = targetComment.likes.indexOf(currentUser.uid);
        
        if (likeIndex > -1) {
          targetComment.likes.splice(likeIndex, 1);
        } else {
          targetComment.likes.push(currentUser.uid);
        }
    
        const postDocRef = doc(db, 'posts', id);
        await updateDoc(postDocRef, {
          comments: updatedComments
        });
    
        setCommentList(updatedComments);
        
      } catch (error) {
        console.error("Error updating comment likes:", error);
      }
    };
    

    const handleReply = async (e, parentCommentIndex) => {
      e.preventDefault();
      if (!replyText.trim() || !currentUser) return;
    
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
    
        const newReply = {
          text: replyText.trim(),
          user: currentUser.displayName || 'Anonymous',
          userId: currentUser.uid,
          timestamp: new Date().toISOString(),
          profilePic: userData?.profilePic || null,
          likes: []
        };
    
        const updatedComments = [...commentList];
        
        if (!Array.isArray(updatedComments[parentCommentIndex].replies)) {
          updatedComments[parentCommentIndex].replies = [];
        }
        
        updatedComments[parentCommentIndex].replies.push(newReply);
    
        const postDocRef = doc(db, 'posts', id);
        await updateDoc(postDocRef, {
          comments: updatedComments
        });
    
        setCommentList(updatedComments);
        setReplyText('');
        setReplyingTo(null);
    
      } catch (error) {
        console.error("Error adding reply:", error);
      }
    };

    const handleDeleteComment = async (commentIndex, replyIndex = null) => {
      if (!currentUser) return;

      try {
        const updatedComments = [...commentList];
        const comment = updatedComments[commentIndex];

        const canDelete = 
          currentUser.uid === userId ||
          currentUser.uid === comment.userId ||
          userType === 'Admin';

        if (!canDelete) {
          console.log("No permission to delete comment");
          return;
        }

        if (replyIndex !== null) {
          if (Array.isArray(comment.replies)) {
            comment.replies.splice(replyIndex, 1);
          }
        } else {
          updatedComments.splice(commentIndex, 1);
        }

        setCommentList(updatedComments);
        
        const postDocRef = doc(db, 'posts', id);
        await updateDoc(postDocRef, {
          comments: updatedComments
        });
      } catch (error) {
        console.error("Error deleting comment:", error);
      }
    };

    const CommentComponent = ({ 
    comment, 
    index, 
    isReply = false, 
    parentIndex = null, 
    handleCommentLike, 
    handleDeleteComment, 
    handleReply,
    currentUser, 
    userType, 
    userId,
    replyText,
    setReplyText,
    replyingTo,
    setReplyingTo
  }) => {
      const [isLiked, setIsLiked] = useState(
        Array.isArray(comment?.likes) && currentUser && comment.likes.includes(currentUser?.uid)
      );
    
      useEffect(() => {
        if (comment?.likes) {
          setIsLiked(Array.isArray(comment.likes) && currentUser && comment.likes.includes(currentUser?.uid));
        }
      }, [comment?.likes, currentUser]);
      
      const handleLikeClick = () => {
        if (!currentUser) return;
        handleCommentLike(index, isReply, parentIndex);
      };
    
      const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'Unknown time';
        const now = new Date();
        const commentDate = new Date(timestamp);
        
        if (isNaN(commentDate.getTime())) return 'Invalid date';
        
        const diffInHours = Math.floor((now - commentDate) / (1000 * 60 * 60));
        
        if (diffInHours < 1) {
          const diffInMinutes = Math.floor((now - commentDate) / (1000 * 60));
          return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
        } else if (diffInHours < 24) {
          return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
        } else {
          const diffInDays = Math.floor(diffInHours / 24);
          return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
        }
      };
    
      if (!comment) return null;
    
      return (
        <div className={`bg-white p-4 rounded-lg border border-gray-100 shadow-sm mb-3
          ${isReply ? 'ml-8 border-l-4 border-l-[#5f9ea0]' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {comment.profilePic ? (
                <img 
                  src={comment.profilePic} 
                  alt={comment.user || 'User'} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/40';
                  }}
                />
              ) : (
                <UserCircle className="text-gray-400" />
              )}
            </div>
            
            <div className="flex-grow">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h3 className="font-semibold text-gray-800">{comment.user || 'Anonymous'}</h3>
                  <p className="text-xs text-gray-500">{formatTimestamp(comment.timestamp)}</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {currentUser && (
                    <>
                      {!isReply && (
                        <button 
                          onClick={() => setReplyingTo(index)}
                          className="flex items-center gap-1 text-gray-500 hover:text-[#5f9ea0] transition-colors duration-200"
                        >
                          <Reply size={16} />
                          <span className="text-sm">Reply</span>
                        </button>
                      )}
                      <button 
                        onClick={handleLikeClick}
                        className={`flex items-center gap-1 transition-all duration-200 hover:scale-105
                          ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
                      >
                        <Heart 
                          size={16} 
                          className={isLiked ? 'fill-current' : ''} 
                        />
                        <span className="text-sm">
                          {Array.isArray(comment.likes) ? comment.likes.length : 0}
                        </span>
                      </button>
                      {(currentUser.uid === userId || 
                        currentUser.uid === comment.userId || 
                        userType === 'Admin') && (
                        <button 
                          onClick={() => handleDeleteComment(isReply ? parentIndex : index, isReply ? index : null)}
                          className="text-gray-400 hover:text-red-500 transition-colors duration-200"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              <p className="text-gray-700 mt-2 leading-relaxed">{comment.text}</p>
              
              {!isReply && Array.isArray(comment.replies) && comment.replies.length > 0 && (
                <div className="mt-4 space-y-3">
                  {comment.replies.map((reply, replyIndex) => (
                    <CommentComponent 
                      key={`${reply.timestamp}-${replyIndex}`}
                      comment={reply}
                      index={replyIndex}
                      isReply={true}
                      parentIndex={index}
                      handleCommentLike={handleCommentLike}
                      handleDeleteComment={handleDeleteComment}
                      handleReply={handleReply}
                      currentUser={currentUser}
                      userType={userType}
                      userId={userId}
                      commentText={commentText}
                      setCommentText={setCommentText}
                      replyingTo={replyingTo}
                      setReplyingTo={setReplyingTo}
                    />
                  ))}
                </div>
              )}
              
              {replyingTo === index && !isReply && (
                <div className="mt-4 pl-6 reply-form-container">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleReply(e, index);
                  }} className="space-y-3 bg-gray-50 p-3 rounded-lg border border-gray-200 animate-fadeIn">
                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full p-3 bg-white text-gray-800 border border-gray-200 rounded-lg 
                        focus:ring-2 focus:ring-[#5f9ea0] focus:border-transparent outline-none resize-none 
                        placeholder-gray-400 transition-all duration-200"
                      rows="2"
                      placeholder="Write a reply..."
                    />
                    <div className="flex gap-2">
                      <button 
                        type="submit"
                        disabled={!replyText.trim()}
                        className="bg-[#5f9ea0] hover:bg-[#4f8e90] text-white font-medium py-2 px-4 
                          rounded-lg transition duration-200 ease-in-out hover:shadow-md disabled:opacity-50 
                          disabled:cursor-not-allowed"
                      >
                        Reply
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 
                          rounded-lg transition duration-200 ease-in-out"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

    const incrementViewCount = async () => {
      const postDocRef = doc(db, 'posts', id);
      try {
        await updateDoc(postDocRef, {
          views: views + 1,
        });
      } catch (error) {
        console.error("Error updating view count: ", error);
      }
    };

    useEffect(() => {
      incrementViewCount();
      updateUserBalance(views + 1, localLikes.length, userId);
    }, []);

    const toggleLike = async () => {
      if (!currentUser) return;
      
      const postDocRef = doc(db, 'posts', id);
      try {
        if (liked) {
          setLocalLikes(prev => prev.filter(uid => uid !== currentUser.uid));
          setLiked(false);
          
          await updateDoc(postDocRef, {
            likes: arrayRemove(currentUser.uid)
          });
        } else {
          setLocalLikes(prev => [...prev, currentUser.uid]);
          setLiked(true);
          
          await updateDoc(postDocRef, {
            likes: arrayUnion(currentUser.uid)
          });
        }
        
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === id 
              ? { ...post, likes: liked 
                  ? post.likes.filter(uid => uid !== currentUser.uid)
                  : [...post.likes, currentUser.uid] 
                }
              : post
          )
        );
      } catch (error) {
        console.error("Error toggling like: ", error);
        setLiked(!liked);
        setLocalLikes(likes);
      }
    };

const handleCommentSubmit = async (e) => {
  e.preventDefault();
  if (!commentText.trim() || !currentUser) return;

  try {
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();

    const newComment = {
      text: commentText.trim(),
      user: currentUser.displayName || 'Anonymous',
      userId: currentUser.uid,
      timestamp: new Date().toISOString(),
      profilePic: userData?.profilePic || null,
      likes: [],
      replies: []
    };

    const updatedComments = [...commentList, newComment];

    const postDocRef = doc(db, 'posts', id);
    await updateDoc(postDocRef, { 
      comments: updatedComments
    });

    setCommentList(updatedComments);
    setCommentText('');
    
  } catch (error) {
    console.error("Error adding comment:", error);
  }
};

    useEffect(() => {
      const fetchCommentUserProfiles = async () => {
        const updatedComments = await Promise.all(
          commentList.map(async (comment) => {
            if (!comment.profilePic && comment.userId) {
              try {
                const userDocRef = doc(db, 'users', comment.userId);
                const userDoc = await getDoc(userDocRef);
                const userData = userDoc.data();
                return { ...comment, profilePic: userData?.profilePic || null };
              } catch (error) {
                console.error("Error fetching user profile:", error);
                return comment;
              }
            }
            return comment;
          })
        );

        if (JSON.stringify(updatedComments) !== JSON.stringify(commentList)) {
          setCommentList(updatedComments);
          const postDocRef = doc(db, 'posts', id);
          await updateDoc(postDocRef, { comments: updatedComments });
        }
      };

      fetchCommentUserProfiles();
    }, []);

    const closeModal = () => {
      const commentBox = document.querySelector('.comment-box');
      commentBox?.classList.remove('show');
      setTimeout(() => {
        setCommentModalVisible(false);
      }, 300);
    };

    const openModal = () => {
      setCommentModalVisible(true);
      setTimeout(() => {
        const commentBox = document.querySelector('.comment-box');
        commentBox?.classList.add('show');
      }, 10);
    };

    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === 'Escape' && isCommentModalVisible) {
          closeModal();
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isCommentModalVisible]);


    const handleEdit = () => router.push(`/Learn&Share/Forums/${id}`);
    
    const handleDelete = async () => {
      try {
        await deleteDoc(doc(db, 'posts', id));
        setPosts((prevPosts) => prevPosts.filter((post) => post.id !== id));
      } catch (error) {
        console.error("Error deleting post: ", error);
      }
    };

    return (
      <div className="feed-card w-full h-full flex flex-col rounded-xl bg-white shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center p-5 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#5f9ea0] shadow-sm">
            <img 
              src={profilePic || "https://via.placeholder.com/48"} 
              alt={name} 
              className="w-full h-full object-cover" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://via.placeholder.com/48";
              }}
            />
          </div>
          <div className="ml-3">
            <p className="font-semibold text-gray-800">{name}</p>
            <p className="text-gray-500 text-xs">{time}</p>
          </div>
          {currentUser && currentUser.uid === userId && (
            <div className="ml-auto flex space-x-2">
              <button 
                onClick={handleEdit} 
                className="text-[#5f9ea0] hover:text-[#4f8e90] p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/>
                </svg>
              </button>
              <button 
                onClick={handleDelete} 
                className="text-red-500 hover:text-red-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Card Content */}
        <div className="p-5 flex-grow">
          <h2 className="text-xl font-bold text-gray-800 mb-3">{title}</h2>

          <div className="mb-4 flex-grow">
            {imageUrl && (
              <div 
                className="cursor-pointer mb-4 overflow-hidden rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                onClick={() => setSelectedImage(imageUrl)}
              >
                <img 
                  src={imageUrl} 
                  alt="Post" 
                  className="w-full h-auto max-h-80 object-cover transition-transform duration-300 hover:scale-105" 
                  loading="lazy"
                />
              </div>
            )}
            <p className="text-gray-700 leading-relaxed line-clamp-3">{content}</p>
          </div>
        </div>

        {/* Card Footer */}
        <div className="mt-auto flex justify-between items-center p-5 bg-gray-50 text-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Eye size={18} strokeWidth={2} />
            <span>{views}</span>
          </div>
          <button 
            onClick={toggleLike} 
            className={`flex items-center gap-2 transition-all duration-200 ${liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
          >
            <Heart size={18} strokeWidth={2} className={liked ? 'fill-current' : ''} />
            <span>{localLikes.length}</span>
          </button>
          <button 
            onClick={openModal}
            className="flex items-center gap-2 text-gray-500 hover:text-[#5f9ea0] transition-colors"
          >
            <MessageCircle size={18} strokeWidth={2} />
            <span>{commentList.length}</span>
          </button>
        </div>

        {/* Comment Modal */}
        {isCommentModalVisible && (
          <StyledModal>
            <div className="modal fixed inset-0 z-50 flex items-center justify-center" onClick={closeModal}>
              <div className="comment-box w-full max-w-3xl rounded-xl shadow-2xl mx-4 bg-white" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#5f9ea0] to-[#4f8e90] text-white rounded-t-xl">
                  <h2 className="text-xl font-semibold">Comments ({commentList.length})</h2>
                  <button 
                    onClick={closeModal} 
                    className="text-white/80 hover:text-white transition duration-200 rounded-full hover:bg-white/10 p-2"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Comments List */}
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {commentList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                      <MessageCircle size={32} className="mb-2 opacity-50" />
                      <p className="text-center">No comments yet. Be the first to comment!</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {commentList.map((comment, index) => (
                        <CommentComponent 
                          key={`comment-${index}-${comment.timestamp}`}
                          comment={comment}
                          index={index}
                          handleCommentLike={handleCommentLike}
                          handleDeleteComment={handleDeleteComment}
                          handleReply={handleReply}
                          currentUser={currentUser}
                          userType={userType}
                          userId={userId}
                          replyText={replyText}
                          setReplyText={setReplyText}
                          replyingTo={replyingTo}
                          setReplyingTo={setReplyingTo}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                  {currentUser ? (
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {currentUser?.photoURL ? (
                          <img 
                            src={currentUser.photoURL} 
                            alt={currentUser.displayName} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/40';
                            }}
                          />
                        ) : (
                          <UserCircle className="text-gray-400" size={24} />
                        )}
                      </div>
                      <form onSubmit={handleCommentSubmit} className="flex-grow">
                        <textarea 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="w-full p-3 bg-white text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#5f9ea0] focus:border-transparent outline-none resize-none placeholder-gray-400 transition-all duration-200"
                          rows="3"
                          placeholder="Share your thoughts..."
                        />
                        <button 
                          type="submit"
                          disabled={!commentText.trim()}
                          className="mt-2 bg-[#5f9ea0] hover:bg-[#4f8e90] text-white font-medium py-2 px-6 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Post Comment
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 mb-2">Sign in to join the conversation</p>
                      <button 
                        onClick={() => router.push('/auth/login')}
                        className="bg-[#5f9ea0] hover:bg-[#4f8e90] text-white font-medium py-2 px-6 rounded-lg transition duration-300 ease-in-out"
                      >
                        Log In
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </StyledModal>
        )}
      </div>
    );
};

const handleCreatePost = () => router.push('Forums/Create-Page');
const toggleMyPosts = () => setShowMyPosts((prev) => !prev);

return (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-3 md:px-6 py-6">
    <div className="w-full max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 md:mb-12">
        <div className="mb-4 md:mb-0">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 flex items-center">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#5f9ea0] to-[#4a8b8d] mr-2">Community</span> 
            <span>Forums</span>
          </h1>
          <p className="text-gray-600 mt-2">Share knowledge, ask questions, connect with peers</p>
        </div>
        <div className="flex space-x-4">
          <StyledWrapper>
            {isMobile ? (
              <button className="ui-btn-mobile create-post" onClick={handleCreatePost}>
                <PlusCircle size={20} strokeWidth={2.5} />
              </button>
            ) : (
              <button className="ui-btn create-post" onClick={handleCreatePost}>
                <PlusCircle size={18} />
                <span>Create Post</span>
              </button>
            )}
          </StyledWrapper>
          <StyledWrapper>
            {isMobile ? (
              <button 
                className={`ui-btn-mobile ${showMyPosts ? 'my-posts' : ''}`}
                onClick={toggleMyPosts}
              >
                <UserCircle size={20} strokeWidth={2.5} />
              </button>
            ) : (
              <button 
                className={`ui-btn ${showMyPosts ? 'my-posts' : ''}`}
                onClick={toggleMyPosts}
              >
                <UserCircle size={18} />
                <span>{showMyPosts ? 'All Posts' : 'My Posts'}</span>
              </button>
            )}
          </StyledWrapper>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {posts.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center p-10 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="text-gray-400 mb-6 animate-pulse">
                <MessageCircle size={64} />
              </div>
              <h3 className="text-2xl font-medium text-gray-700 mb-3">No posts found</h3>
              <p className="text-gray-500 text-center max-w-md">
                {showMyPosts 
                  ? "You haven't created any posts yet. Click 'Create Post' to get started!" 
                  : "There are no posts in this forum yet. Be the first to start a discussion!"}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="feed-card-wrapper transform hover:-translate-y-1 transition-all duration-300">
                <FeedCard {...post} />
              </div>
            ))
          )}
        </div>
      )}

      {selectedImage && (
        <ImageModal 
          imageUrl={selectedImage} 
          onClose={() => setSelectedImage(null)} 
        />
      )}
    </div>
  </div>
);
}

// Update StyledWrapper component
const StyledWrapper = styled.div`
  .ui-btn, .ui-btn-mobile {
    --primary-color: #5f9ea0;
    --primary-hover: #4a8b8d;
    --secondary-color: #2c3e50;
    --accent-color: #f39c12;
    --bg-light: #f8f9fa;
    --text-color: #fff;
    --text-hover: #fff;
    --transition: 0.25s cubic-bezier(0.3, 0, 0.8, 1);
    --shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
    --hover-shadow: 0 7px 14px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);
    --radius: 8px;
    
    background: var(--primary-color);
    color: var(--text-color);
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    transition: all var(--transition);
    box-shadow: var(--shadow);
    font-weight: 600;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .ui-btn {
    padding: 12px 24px;
    font-size: 16px;
    min-width: 140px;
    letter-spacing: 0.5px;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  
  .ui-btn-mobile {
    padding: 12px;
    border-radius: 50%;
    width: 48px;
    height: 48px;
  }
  
  .ui-btn::before, .ui-btn-mobile::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0));
    transform: translateY(-100%);
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .ui-btn:hover, .ui-btn-mobile:hover {
    transform: translateY(-3px);
    box-shadow: var(--hover-shadow);
    background: var(--primary-hover);
  }
  
  .ui-btn:hover::before, .ui-btn-mobile:hover::before {
    transform: translateY(0);
  }
  
  .ui-btn:active, .ui-btn-mobile:active {
    transform: translateY(0);
  }
  
  .my-posts {
    background: var(--secondary-color);
  }
  
  .my-posts:hover {
    background: #3a506b;
  }
  
  .create-post {
    background: var(--accent-color);
  }
  
  .create-post:hover {
    background: #e67e22;
  }
`;



export default Feed;