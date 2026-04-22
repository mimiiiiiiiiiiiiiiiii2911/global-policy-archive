                    </article>
                `;
            }).join('');
        }

        async function postStatus() {
            const content = document.getElementById('statusInput').value;
            const category = document.getElementById('categoryInput').value;
            if(!content.trim()) return;
            const btn = document.getElementById('btnPost');
            btn.innerText = "ENCRYPTING & PUBLISHING...";
            const { error } = await _supabase.from('posts').insert([{ content, category }]);
            if (!error) { 
                document.getElementById('statusInput').value = ''; 
                document.getElementById('adminPanel').style.display = 'none';
                fetchPosts(); 
            }
            btn.innerText = "Publish Dispatch";
        }

        function toggleAdmin() {
            const panel = document.getElementById('adminPanel');
            const pass = prompt("Authorization Required:");
            if (pass === "1234") { 
                panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            } else {
                alert("Access Denied.");
            }
        }
        fetchPosts();
    </script>
</body>
</html>
